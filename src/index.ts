import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = Fastify();

app.register(cors);

app.get('/habits', async () => {
  const habits = await prisma.habit.findMany();
  return habits 
});

app.listen({
  port: 3333,
}).then(() => {
  console.log('Server started on port 3333');
});