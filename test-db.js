const { PrismaClient } = require('./server/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function test() {
  const p = await prisma.project.findFirst();
  console.log(p);
  const m = await prisma.requestLog.count();
  console.log("Logs:", m);
  process.exit(0);
}
test();
