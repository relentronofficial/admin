import type { FastifyReply, FastifyRequest } from 'fastify';
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema, assignTaskSchema, taskInitiativeSchema } from './schema.js';

export async function createTaskInitiativeHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = taskInitiativeSchema.parse(request.body);
  const taskId = `TBT-TASK-${Math.floor(1000 + Math.random() * 9000)}`;

  const task = await request.server.prisma.task.create({
    data: {
      taskId,
      title: body.taskTitle,
      description: body.taskDescription,
      priority: 'Medium',
      status: 'Todo',
      dueDate: new Date(),
    } as any,
  });

  return reply.status(201).send({ success: true, data: task, error: null });
}

export async function listTasksHandler(request: FastifyRequest, reply: FastifyReply) {
  const tasks = await request.server.prisma.task.findMany({
    include: { assignedTo: true, assignedBy: true } as any,
  });
  return reply.send({ success: true, data: tasks, error: null });
}

export async function createTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createTaskSchema.parse(request.body);
  const taskId = `TBT-TASK-${Math.floor(1000 + Math.random() * 9000)}`;

  const task = await request.server.prisma.task.create({
    data: {
      ...body,
      taskId,
      assignedById: request.user,
      dueDate: new Date(body.dueDate),
    } as any,
  });

  return reply.status(201).send({ success: true, data: task, error: null });
}

export async function getTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const task = await request.server.prisma.task.findUnique({
    where: { id },
    include: { assignedTo: true, assignedBy: true } as any,
  });
  if (!task) return reply.status(404).send({ success: false, data: null, error: 'Task not found' });
  return reply.send({ success: true, data: task, error: null });
}

export async function updateTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = updateTaskSchema.parse(request.body);
  const task = await request.server.prisma.task.update({
    where: { id },
    data: {
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    } as any,
  });
  return reply.send({ success: true, data: task, error: null });
}

export async function deleteTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.task.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function updateTaskStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { status } = updateTaskStatusSchema.parse(request.body);
  const task = await request.server.prisma.task.update({
    where: { id },
    data: { status: status as any, completedAt: status === 'Done' ? new Date() : null } as any,
  });
  return reply.send({ success: true, data: task, error: null });
}

export async function assignTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { adminId } = assignTaskSchema.parse(request.body);
  const task = await request.server.prisma.task.update({
    where: { id },
    data: { assignedToId: adminId } as any,
  });
  return reply.send({ success: true, data: task, error: null });
}
