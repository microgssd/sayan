'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../auth';
import { connectDB } from '../db';
import { Message } from '../models/Message';
import type { ActionResult } from '../types';

export async function setMessageStatus(id: string, status: 'new' | 'read' | 'archived' | 'spam'): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return { ok: false, error: 'Message not found.' };
  await connectDB();
  await Message.updateOne({ _id: id }, { status });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: status === 'archived' ? 'Message archived.' : status === 'read' ? 'Marked as read.' : status === 'spam' ? 'Moved to spam.' : 'Moved to your inbox.' };
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isValidObjectId(id)) return { ok: false, error: 'Message not found.' };
  await connectDB();
  await Message.deleteOne({ _id: id });
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Message deleted.' };
}
