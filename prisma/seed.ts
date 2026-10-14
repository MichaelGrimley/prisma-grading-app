"dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  await prisma.testResult.deleteMany({});
  await prisma.courseEnrollment.deleteMany({});
  await prisma.test.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.course.deleteMany({});

  // Seed operations go here, step by step below
  const grace = await prisma.user.create({
    data: {
      email: "grace@hey.com",
      firstName: "Grace",
      lastName: "Bell",
      social: {
        bluesky: "gracebell",
        linkedin: "gracebell",
      },
    },
  });

  const weekFromNow = addDays(new Date(), 7);
  const twoWeeksFromNow = addDays(new Date(), 14);
  const monthFromNow = addDays(new Date(), 28);

  const course = await prisma.course.create({
    data: {
      name: "CRUD with Prisma",
      tests: {
        create: [
          { date: weekFromNow, name: "First test" },
          { date: twoWeeksFromNow, name: "Second test" },
          { date: monthFromNow, name: "Final Exam" },
        ],
      },
      members: {
        create: {
          role: "TEACHER",
          user: {
            connect: {
              email: grace.email,
            },
          },
        },
      },
    },
    include: {
      tests: true,
    },
  });

  const shakuntala = await prisma.user.create({
    data: {
      email: "devi@prisma.io",
      firstName: "Shakuntala",
      lastName: "Devi",
      courses: {
        create: {
          role: "STUDENT",
          course: {
            connect: { id: course.id },
          },
        },
      },
    },
  });

  const david = await prisma.user.create({
    data: {
      email: "david@prisma.io",
      firstName: "David",
      lastName: "Deutsch",
      courses: {
        create: {
          role: "STUDENT",
          course: {
            connect: { id: course.id },
          },
        },
      },
    },
  });

  const testResultsDavid = [650, 900, 950];
  const testResultsShakuntala = [800, 950, 910];

  for (let i = 0; i < course.tests.length; i++) {
    const test = course.tests[i];

    await prisma.testResult.create({
      data: {
        gradedBy: { connect: { email: grace.email } },
        student: { connect: { email: shakuntala.email } },
        test: { connect: { id: test.id } },
        result: testResultsShakuntala[i],
      },
    });

    await prisma.testResult.create({
      data: {
        gradedBy: { connect: { email: grace.email } },
        student: { connect: { email: david.email } },
        test: { connect: { id: test.id } },
        result: testResultsDavid[i],
      },
    });
  }

  for (let i = 0; i < course.tests.length; i++) {
    const test = course.tests[i];

    const results = await prisma.testResult.aggregate({
      where: {
        testId: test.id,
      },
      _avg: { result: true },
      _max: { result: true },
      _min: { result: true },
      _count: true,
    });
    console.log(`test: ${test.name} (id:${test.id})`, results);
  }

  const davidAggregates = await prisma.testResult.aggregate({
    where: {
      student: { email: david.email },
    },
    _avg: { result: true },
    _max: { result: true },
    _min: { result: true },
    _count: true,
  });
  console.log(`David's results (email: ${david.email})`, davidAggregates);


  const shakuntalaAggregates = await prisma.testResult.aggregate({
    where:{
        student:{email: shakuntala.email},
    },
    _avg:{result:true},
    _max:{result:true},
    _min:{result:true},
    _count: true,
  })
console.log(`Shakuntala's results (email: ${shakuntala.email})`, shakuntalaAggregates)
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
