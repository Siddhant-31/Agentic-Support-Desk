import dotenv from "dotenv";
import { pool } from "./pool";
import { embedText, toVectorLiteral } from "../support/embeddings";

// Seeds two demo companies, each with their own orders and their own
// policy documents, so you can see multi-tenancy actually working (log
// in as a user from Company A and confirm you cannot see Company B's
// orders or policies). Safe to re-run - it clears and reinserts, rather
// than erroring on duplicates.

type SeedCompany = {
  name: string;
  domain: string;
  orders: Array<{
    id: string;
    customer: string;
    product: string;
    amount: number;
    currency: string;
    purchaseDate: string;
    status: "active" | "cancelled";
  }>;
  policies: Array<{ title: string; sections: Array<{ heading: string; text: string }> }>;
};

const COMPANIES: SeedCompany[] = [
  {
    name: "Acme Corp",
    domain: "acme.com",
    orders: [
      {
        id: "ORD-1001",
        customer: "Acme Corp",
        product: "Team Plan (Annual)",
        amount: 1200.0,
        currency: "USD",
        purchaseDate: "2026-08-02",
        status: "cancelled",
      },
      {
        id: "ORD-1002",
        customer: "Globex LLC",
        product: "Pro Plan (Monthly)",
        amount: 49.0,
        currency: "USD",
        purchaseDate: "2026-09-10",
        status: "active",
      },
    ],
    policies: [
      {
        title: "Refund Policy",
        sections: [
          {
            heading: "Standard cancellations",
            text:
              "Customers who cancel within 14 days of purchase are eligible for a full " +
              "refund, regardless of plan type. After 14 days, refunds are prorated " +
              "based on unused time remaining on the current billing period.",
          },
          {
            heading: "Annual plans",
            text:
              "Annual plans cancelled after the 14-day window are refunded for the " +
              "unused portion of the year, minus a 10% early-termination fee. Monthly " +
              "plans have no early-termination fee.",
          },
          {
            heading: "How refunds are issued",
            text:
              "Approved refunds are issued to the original payment method within 5-7 " +
              "business days. Support agents may propose a refund, but all refunds " +
              "over $100 require manager approval before being processed.",
          },
        ],
      },
      {
        title: "SLA Policy",
        sections: [
          {
            heading: "Response times",
            text:
              "Free and Pro plan customers: first response within 24 business hours. " +
              "Team plan customers: first response within 8 business hours. " +
              "Enterprise customers: first response within 2 business hours.",
          },
        ],
      },
    ],
  },
  {
    name: "Initech",
    domain: "initech.com",
    orders: [
      {
        id: "ORD-2001",
        customer: "Initech",
        product: "Enterprise Onboarding",
        amount: 5000.0,
        currency: "USD",
        purchaseDate: "2026-07-15",
        status: "cancelled",
      },
    ],
    policies: [
      {
        title: "Refund Policy",
        sections: [
          {
            heading: "Enterprise onboarding packages",
            text:
              "Enterprise onboarding fees are non-refundable once onboarding calls " +
              "have started, but are fully refundable if cancelled before the first " +
              "onboarding session.",
          },
          {
            heading: "No prorated refunds",
            text:
              "Unlike self-serve plans, Initech's enterprise contracts are not " +
              "eligible for prorated refunds - cancellation refunds are all-or-nothing " +
              "based on whether onboarding has started.",
          },
        ],
      },
    ],
  },
];

async function seedCompany(spec: SeedCompany) {
  const companyResult = await pool.query<{ id: string }>(
    `INSERT INTO companies (name, domain) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET domain = EXCLUDED.domain
     RETURNING id`,
    [spec.name, spec.domain],
  );
  const companyId = companyResult.rows[0].id;
  console.log(`Company "${spec.name}" -> ${companyId}`);

  for (const order of spec.orders) {
    await pool.query(
      `INSERT INTO orders (id, company_id, customer, product, amount, currency, purchase_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (company_id, id) DO UPDATE SET
         customer = EXCLUDED.customer, product = EXCLUDED.product,
         amount = EXCLUDED.amount, status = EXCLUDED.status`,
      [
        order.id,
        companyId,
        order.customer,
        order.product,
        order.amount,
        order.currency,
        order.purchaseDate,
        order.status,
      ],
    );
  }
  console.log(`  seeded ${spec.orders.length} order(s)`);

  // Wipe and reinsert this company's policy docs/chunks each run, so
  // re-running the seed script after editing a policy above actually
  // updates the embeddings too.
  await pool.query(
    `DELETE FROM policy_documents WHERE company_id = $1`,
    [companyId],
  );

  let chunkCount = 0;
  let embeddedCount = 0;

  for (const doc of spec.policies) {
    const docResult = await pool.query<{ id: string }>(
      `INSERT INTO policy_documents (company_id, title, raw_text) VALUES ($1, $2, $3) RETURNING id`,
      [companyId, doc.title, doc.sections.map((s) => `## ${s.heading}\n${s.text}`).join("\n\n")],
    );
    const docId = docResult.rows[0].id;

    for (const section of doc.sections) {
      const embedding = await embedText(`${section.heading}\n${section.text}`);
      if (embedding) embeddedCount += 1;

      await pool.query(
        `INSERT INTO policy_chunks (company_id, policy_document_id, heading, text, embedding)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          companyId,
          docId,
          section.heading,
          section.text,
          embedding ? toVectorLiteral(embedding) : null,
        ],
      );
      chunkCount += 1;
    }
  }

  console.log(
    `  seeded ${chunkCount} policy chunk(s) (${embeddedCount} with embeddings${
      embeddedCount < chunkCount ? " - set OPENAI_API_KEY to embed the rest" : ""
    })`,
  );
}

async function main() {
  dotenv.config();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Add it to server/.env before seeding.");
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "OPENAI_API_KEY is not set - policy chunks will be seeded WITHOUT embeddings, " +
        "and policy search will fall back to plain keyword search until you add it " +
        "and re-run `npm run db:seed`.",
    );
  }

  for (const company of COMPANIES) {
    await seedCompany(company);
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
