import dayjs from 'dayjs';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from './lib/prisma';

export async function appRoutes(app: FastifyInstance) {
  app.post('/habits', async (request) => {
    const createHabitSchema = z.object({
      title: z.string().min(1).max(255),
      weekDays: z.array(z.number().min(0).max(6)),
    });

    const { title, weekDays } = createHabitSchema.parse(request.body);

    const day = dayjs().startOf('day').toDate();

    const habit = await prisma.habit.create({
      data: {
        title,
        createdAt: day,
        weekDays: {
          create: weekDays.map((weekDay) => ({
            week_day: weekDay,
          })),
        },
      },
    });
  });

  app.get('/day', async (request) => {
    const getDaySchema = z.object({
      date: z.coerce.date(),
    });

    const { date } = getDaySchema.parse(request.query);

    const parsedDate = dayjs(date).startOf('day');
    const weekDay = dayjs(parsedDate).get('day');

    const possibleHabits = await prisma.habit.findMany({
      where: {
        createdAt: {
          lte: date,
        },
        weekDays: {
          some: {
            week_day: weekDay,
          },
        },
      },
    });

    const day = await prisma.day.findUnique({
      where: {
        date: parsedDate.toDate(),
      },
      include: {
        dayHabits: true,
      },
    });

    const completedHabits = day?.dayHabits.map((dayHabit) => ({
      id: dayHabit.habit_id,
    }));

    return {
      possibleHabits,
      completedHabits,
    };
  });

  app.patch('/habits/:id/toggle', async (request) => {
    const toggleHabitParams = z.object({
      id: z.string().uuid(),
    });

    const { id } = toggleHabitParams.parse(request.params);

    const today = dayjs().startOf('day').toDate();

    let day = await prisma.day.findUnique({
      where: {
        date: today,
      },
    });

    if (!day) {
      day = await prisma.day.create({
        data: {
          date: today,
        },
      });
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id,
        },
      },
    });

    if (dayHabit) {
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id,
        },
      });
    } else {
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id,
        },
      });
    }
  });

  app.get('/summary', async () => {
    const summary = await prisma.$queryRaw`
      SELECT 
        D.id, 
        D.date,
        (
          SELECT 
            cast(count(*) as float)
          FROM day_habits DH
          WHERE DH.day_id = D.id 
        ) as completed,
        (
          SELECT
            cast(count(*) as float)
          FROM habit_week_days HWD
          JOIN habits H 
            ON H.id = HWD.habit_id
          WHERE 
            HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
            AND H.createdAt <= D.date
        ) as possible
      FROM days D
    `;
    return { summary };
  });
}
