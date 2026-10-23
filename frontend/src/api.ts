export interface Tag { tag_id: number; tag_name: string }
export interface Folder { folder_id: number; folder_name: string }
export interface Reminder {
  remind_id: number; note_id: number; remind_at: string;
  status: "pending" | "done"; created: string | null;
}
export interface Attachment {
  att_id: number; note_id: number; file_name: string; file_url: string;
  file_type: string | null; file_size: number | null; uploaded_at: string | null;
}
export interface Note {
  note_id: number; title: string; content: string | null;
  folder_id: number | null; folder_name: string | null;
  is_pinned: boolean; created: string; updated: string | null; tags: Tag[];
  reminders: Reminder[]; attachments: Attachment[];
}
export interface NoteInput {
  title: string; content?: string | null; folder_id?: number | null;
  is_pinned?: boolean; tag_ids?: number[];
}

const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (r.status === 204) return undefined as T;
  const data = await r.json();
  if (!r.ok) {
    const d = (data.details ?? []).map((x: any) => x.message).join("; ");
    throw new Error(d || data.error || "Request error");
  }
  return data;
}

export const api = {
  notes: (q: Record<string, string | number | undefined> = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    return req<Note[]>(`/notes?${p}`);
  },
  create: (b: NoteInput) => req<Note>("/notes", { method: "POST", body: JSON.stringify(b) }),
  update: (id: number, b: Partial<NoteInput>) => req<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  remove: (id: number) => req<void>(`/notes/${id}`, { method: "DELETE" }),
  folders: () => req<Folder[]>("/folders"),
  createFolder: (name: string) => req<Folder>("/folders", { method: "POST", body: JSON.stringify({ name }) }),
  removeFolder: (id: number) => req<void>(`/folders/${id}`, { method: "DELETE" }),
  tags: () => req<Tag[]>("/tags"),
  createTag: (name: string) => req<Tag>("/tags", { method: "POST", body: JSON.stringify({ name }) }),
  removeTag: (id: number) => req<void>(`/tags/${id}`, { method: "DELETE" }),
  addReminder: (noteId: number, remind_at: string) =>
    req<Note>(`/notes/${noteId}/reminders`, { method: "POST", body: JSON.stringify({ remind_at }) }),
  updateReminder: (id: number, b: { status?: "pending" | "done"; remind_at?: string }) =>
    req<Note>(`/reminders/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  removeReminder: (id: number) => req<Note>(`/reminders/${id}`, { method: "DELETE" }),
  addAttachment: (noteId: number, b: { file_name: string; file_url: string }) =>
    req<Note>(`/notes/${noteId}/attachments`, { method: "POST", body: JSON.stringify(b) }),
  removeAttachment: (id: number) => req<Note>(`/attachments/${id}`, { method: "DELETE" }),
};