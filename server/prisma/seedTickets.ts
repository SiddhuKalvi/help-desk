import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import type { Prisma } from "../src/generated/prisma/client.ts";

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

const names = [
  "Emma Johnson", "Liam Garcia", "Olivia Chen", "Noah Patel", "Ava Martinez",
  "Elijah Kim", "Sophia Nguyen", "Lucas Rodriguez", "Isabella Brown", "Mason Lee",
  "Mia Davis", "Ethan Wilson", "Amelia Anderson", "James Thompson", "Harper Moore",
  "Benjamin Taylor", "Evelyn White", "Alexander Harris", "Abigail Clark", "Henry Lewis",
  "Emily Walker", "Jacob Hall", "Elizabeth Young", "Michael Allen", "Sofia King",
  "Daniel Wright", "Avery Scott", "Matthew Green", "Ella Baker", "Samuel Adams",
  "Scarlett Nelson", "David Carter", "Grace Mitchell", "Joseph Perez", "Chloe Roberts",
  "Andrew Turner", "Victoria Phillips", "Ryan Campbell", "Zoe Parker", "Nathan Evans",
];

const templates: Record<"general_question" | "technical_question" | "refund_request" | "uncategorized", { subject: string; body: string }[]> = {
  general_question: [
    { subject: "How do I reset my student portal password?", body: "I forgot my password and the reset email never arrived. Can someone help me regain access?" },
    { subject: "Where can I find my class schedule?", body: "I can't locate my schedule anywhere on the portal. Where should I be looking?" },
    { subject: "How do I update my mailing address on file?", body: "I recently moved and need to update the address on my student record." },
    { subject: "What are the office hours for the registrar?", body: "I need to visit in person but can't find current office hours listed anywhere." },
    { subject: "How do I request an official transcript?", body: "I need an official transcript sent to a grad school by next Friday." },
    { subject: "Is financial aid disbursement delayed this semester?", body: "My aid hasn't posted yet and the semester started two weeks ago." },
    { subject: "How do I add a minor to my degree plan?", body: "I'd like to add a Psychology minor. What's the process?" },
    { subject: "Where do I submit my housing application?", body: "I can't find the housing application form for next year." },
    { subject: "How can I check my current GPA?", body: "The grades page isn't showing a cumulative GPA anywhere." },
    { subject: "What's the deadline to drop a course without penalty?", body: "I'm considering dropping a class and want to know the last day to do so." },
  ],
  technical_question: [
    { subject: "Can't log into the student portal", body: "I keep getting 'Invalid credentials' even though I'm sure my password is correct." },
    { subject: "Getting a 500 error when submitting my assignment", body: "The upload fails every time with a server error, even with a small file." },
    { subject: "Video lectures won't load on Safari", body: "Lecture videos spin forever and never play in Safari, though they work in Chrome." },
    { subject: "Two-factor authentication code never arrives", body: "I never receive the SMS code needed to finish logging in." },
    { subject: "Portal shows blank page after login", body: "After I sign in successfully the dashboard is just a blank white screen." },
    { subject: "Unable to upload PDF files larger than 5MB", body: "My assignment PDF is 8MB and the upload silently fails." },
    { subject: "Mobile app keeps crashing on the grades tab", body: "The app crashes every time I tap on the Grades tab." },
    { subject: "Password reset link expired immediately", body: "The reset link in the email says expired the moment I click it." },
    { subject: "Course materials page returns 404", body: "Clicking into any course under Materials gives a Page Not Found error." },
    { subject: "Wifi on campus won't authenticate with my student ID", body: "Campus wifi rejects my credentials even though the portal login works fine." },
  ],
  refund_request: [
    { subject: "Requesting refund for dropped Chemistry 101", body: "I dropped Chem 101 within the refund window but haven't seen the credit yet." },
    { subject: "Overcharged for parking permit, need refund", body: "I was charged twice for the same semester parking permit." },
    { subject: "Refund for duplicate tuition payment", body: "My tuition was charged twice this month by mistake." },
    { subject: "Need refund after withdrawing from semester", body: "I withdrew for medical reasons and need to know about a prorated refund." },
    { subject: "Textbook rental refund not processed", body: "I returned my rental textbook three weeks ago and still no refund." },
    { subject: "Gym membership fee refund request", body: "I'm graduating early and would like a refund for the unused portion of my gym fee." },
    { subject: "Refund for cancelled study abroad program", body: "The study abroad program I paid a deposit for was cancelled by the university." },
    { subject: "Meal plan refund after early move-out", body: "I moved out of the dorms early and have unused meal plan balance." },
    { subject: "Lab fee refund - course was cancelled", body: "The lab section for my course was cancelled after I paid the lab fee." },
    { subject: "Late fee waiver and refund request", body: "I was charged a late fee due to a payment portal outage, requesting a waiver." },
  ],
  uncategorized: [
    { subject: "Need help with my account", body: "Something seems off with my account but I'm not sure what department to contact." },
    { subject: "Question about enrollment", body: "I have a general question about my enrollment status this semester." },
    { subject: "Issue with student services", body: "Not sure this is the right place, but I'm having trouble with a service on campus." },
    { subject: "Follow up on my previous ticket", body: "Following up on a ticket I submitted last week with no response yet." },
    { subject: "Urgent - need assistance", body: "This is time-sensitive, please advise on next steps." },
    { subject: "General inquiry", body: "I have a few questions about how the help desk works." },
    { subject: "Not sure who to contact", body: "I wasn't sure which department handles this, so I'm starting here." },
    { subject: "Can someone call me back?", body: "I'd prefer a phone call to discuss my situation if possible." },
    { subject: "Checking on ticket status", body: "Just checking in on the status of an earlier request." },
    { subject: "Miscellaneous request", body: "I have a small request that doesn't fit any specific category." },
  ],
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

function weightedPick<T>(items: [T, number][]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let r = Math.random() * total;
  for (const [item, weight] of items) {
    if (r < weight) return item;
    r -= weight;
  }
  return items[items.length - 1]![0];
}

function randomDateWithinDays(days: number): Date {
  return new Date(Date.now() - randomInt(0, days * 24 * 60 * 60 * 1000));
}

function randomResolvedAt(createdAt: Date): Date {
  const minMs = 30 * 60 * 1000;
  const maxMs = 5 * 24 * 60 * 60 * 1000;
  const resolvedAt = new Date(createdAt.getTime() + randomInt(minMs, maxMs));
  return resolvedAt > new Date() ? new Date() : resolvedAt;
}

const categoryPool: ["general_question" | "technical_question" | "refund_request" | "uncategorized", number][] = [
  ["general_question", 3],
  ["technical_question", 3],
  ["refund_request", 3],
  ["uncategorized", 1],
];

const statusPool: [Prisma.TicketCreateManyInput["status"], number][] = [
  ["open", 4],
  ["resolved", 3.5],
  ["closed", 2.5],
];

const tickets: Prisma.TicketCreateManyInput[] = Array.from({ length: 100 }, () => {
  const category = weightedPick(categoryPool);
  const { subject, body } = pick(templates[category]);
  const senderName = pick(names);
  const senderEmail = `${senderName.toLowerCase().replace(/[^a-z ]/g, "").replace(/ +/g, ".")}@northfield.edu`;
  const status = weightedPick(statusPool);
  const createdAt = randomDateWithinDays(120);

  return {
    subject,
    body,
    senderName,
    senderEmail,
    status,
    category: category === "uncategorized" ? null : category,
    createdAt,
    resolvedAt: status === "resolved" || status === "closed" ? randomResolvedAt(createdAt) : null,
  };
});

await prisma.ticket.createMany({ data: tickets });

console.log(`Seeded ${tickets.length} tickets.`);

await prisma.$disconnect();
