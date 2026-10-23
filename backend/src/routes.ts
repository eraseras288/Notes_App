import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { pool, USER_ID } from "./db";
import { HttpError, validate } from "./middleware";

export const router = Router();
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const idParam = z.object({ id: z.coerce.number().int().positive() });

const noteBody = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  content: z.string().nullable().optional(),
  folder_id: z.number().int().positive().nullable().optional(),
  is_pinned: z.boolean().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
});
const notePatch = noteBody.partial();

const nameBody = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
});

const listQuery = z.object({
  folder_id: z.coerce.number().int().positive().optional(),
  tag_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
});

const SELECT_NOTES = `
  SELECT n.note_id, n.title, n.content, n.folder_id, n.created, n.updated, n.is_pinned,
         f.folder_name,
         (SELECT COALESCE(json_agg(r ORDER BY r.remind_at), '[]') FROM Reminders r WHERE r.note_id = n.note_id) AS reminders,
         (SELECT COALESCE(json_agg(a ORDER BY a.att_id), '[]') FROM Attachment a WHERE a.note_id = n.note_id) AS attachments,
         COALESCE(json_agg(json_build_object('tag_id', t.tag_id, 'tag_name', t.tag_name))
                  FILTER (WHERE t.tag_id IS NOT NULL), '[]') AS tags
  FROM Note n
  LEFT JOIN Folder f ON f.folder_id = n.folder_id
  LEFT JOIN NoteTag nt ON nt.note_id = n.note_id
  LEFT JOIN Tag t ON t.tag_id = nt.tag_id`;

async function setTags(noteId: number, tagIds: number[]) {
  await pool.query("DELETE FROM NoteTag WHERE note_id = $1", [noteId]);
  if (tagIds.length)
    await pool.query(
      `INSERT INTO NoteTag(note_id, tag_id)
       SELECT $1, tag_id FROM Tag WHERE tag_id = ANY($2) AND user_id = $3`,
      [noteId, tagIds, USER_ID]
    );
}

async function getNote(id: number) {
  const { rows } = await pool.query(
    `${SELECT_NOTES} WHERE n.note_id = $1 AND n.user_id = $2 GROUP BY n.note_id, f.folder_name`,
    [id, USER_ID]
  );
  if (!rows[0]) throw new HttpError(404, "note not found");
  return rows[0];
}

router.get("/notes", validate(listQuery, "query"), wrap(async (req, res) => {
  const { folder_id, tag_id, search } = req.query as unknown as z.infer<typeof listQuery>;
  const { rows } = await pool.query(
    `${SELECT_NOTES}
     WHERE n.user_id = $1
       AND ($2::int IS NULL OR n.folder_id = $2)
       AND ($3::int IS NULL OR EXISTS (SELECT 1 FROM NoteTag x WHERE x.note_id = n.note_id AND x.tag_id = $3))
       AND ($4::text IS NULL OR n.title ILIKE '%'||$4||'%' OR n.content ILIKE '%'||$4||'%')
     GROUP BY n.note_id, f.folder_name
     ORDER BY n.is_pinned DESC, COALESCE(n.updated, n.created) DESC`,
    [USER_ID, folder_id ?? null, tag_id ?? null, search || null]
  );
  res.json(rows);
}));

router.get("/notes/:id", validate(idParam, "params"), wrap(async (req, res) => {
  res.json(await getNote(Number(req.params.id)));
}));

router.post("/notes", validate(noteBody), wrap(async (req, res) => {
  const b = req.body as z.infer<typeof noteBody>;
  const { rows } = await pool.query(
    `INSERT INTO Note(user_id, folder_id, title, content, is_pinned)
     VALUES ($1,$2,$3,$4,$5) RETURNING note_id`,
    [USER_ID, b.folder_id ?? null, b.title, b.content ?? null, b.is_pinned ?? false]
  );
  await setTags(rows[0].note_id, b.tag_ids ?? []);
  res.status(201).json(await getNote(rows[0].note_id));
}));

router.put("/notes/:id", validate(idParam, "params"), validate(notePatch), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await getNote(id);
  const b = req.body as z.infer<typeof notePatch>;
  await pool.query(
    `UPDATE Note SET title=$1, content=$2, folder_id=$3, is_pinned=$4, updated=now() WHERE note_id=$5`,
    [
      b.title ?? cur.title,
      b.content === undefined ? cur.content : b.content,
      b.folder_id === undefined ? cur.folder_id : b.folder_id,
      b.is_pinned ?? cur.is_pinned,
      id,
    ]
  );
  if (b.tag_ids) await setTags(id, b.tag_ids);
  res.json(await getNote(id));
}));

router.delete("/notes/:id", validate(idParam, "params"), wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM Note WHERE note_id=$1 AND user_id=$2", [req.params.id, USER_ID]);
  if (!rowCount) throw new HttpError(404, "note not found");
  res.status(204).end();
}));

router.get("/folders", wrap(async (_req, res) => {
  const { rows } = await pool.query("SELECT folder_id, folder_name FROM Folder WHERE user_id=$1 ORDER BY folder_id", [USER_ID]);
  res.json(rows);
}));

router.post("/folders", validate(nameBody), wrap(async (req, res) => {
  const { rows } = await pool.query(
    "INSERT INTO Folder(user_id, folder_name) VALUES ($1,$2) RETURNING folder_id, folder_name",
    [USER_ID, req.body.name]
  );
  res.status(201).json(rows[0]);
}));

router.delete("/folders/:id", validate(idParam, "params"), wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM Folder WHERE folder_id=$1 AND user_id=$2", [req.params.id, USER_ID]);
  if (!rowCount) throw new HttpError(404, "folder not found");
  res.status(204).end();
}));

router.get("/tags", wrap(async (_req, res) => {
  const { rows } = await pool.query("SELECT tag_id, tag_name FROM Tag WHERE user_id=$1 ORDER BY tag_id", [USER_ID]);
  res.json(rows);
}));

router.post("/tags", validate(nameBody), wrap(async (req, res) => {
  const { rows } = await pool.query(
    "INSERT INTO Tag(user_id, tag_name) VALUES ($1,$2) RETURNING tag_id, tag_name",
    [USER_ID, req.body.name]
  );
  res.status(201).json(rows[0]);
}));

router.delete("/tags/:id", validate(idParam, "params"), wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM Tag WHERE tag_id=$1 AND user_id=$2", [req.params.id, USER_ID]);
  if (!rowCount) throw new HttpError(404, "tag not found");
  res.status(204).end();
}));

const dateStr = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
const reminderBody = z.object({ remind_at: dateStr });
const reminderPatch = z.object({
  status: z.enum(["pending", "done"]).optional(),
  remind_at: dateStr.optional(),
});

router.post("/notes/:id/reminders", validate(idParam, "params"), validate(reminderBody), wrap(async (req, res) => {
  const id = Number(req.params.id);
  await getNote(id);
  await pool.query("INSERT INTO Reminders(note_id, remind_at) VALUES ($1, $2::timestamp)", [id, req.body.remind_at]);
  res.status(201).json(await getNote(id));
}));

router.put("/reminders/:id", validate(idParam, "params"), validate(reminderPatch), wrap(async (req, res) => {
  const b = req.body as z.infer<typeof reminderPatch>;
  const { rows } = await pool.query(
    `UPDATE Reminders r
        SET status = COALESCE($1, r.status), remind_at = COALESCE($2::timestamp, r.remind_at)
       FROM Note n
      WHERE r.remind_id = $3 AND n.note_id = r.note_id AND n.user_id = $4
      RETURNING r.note_id`,
    [b.status ?? null, b.remind_at ?? null, req.params.id, USER_ID]
  );
  if (!rows[0]) throw new HttpError(404, "reminder not found");
  res.json(await getNote(rows[0].note_id));
}));

router.delete("/reminders/:id", validate(idParam, "params"), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM Reminders r USING Note n
      WHERE r.remind_id = $1 AND n.note_id = r.note_id AND n.user_id = $2
      RETURNING r.note_id`,
    [req.params.id, USER_ID]
  );
  if (!rows[0]) throw new HttpError(404, "reminder not found");
  res.json(await getNote(rows[0].note_id));
}));

const attachmentBody = z.object({
  file_name: z.string().trim().min(1, "File name is required").max(255),
  file_url: z.string().trim().max(500)
    .url("Must be a valid URL")
    .refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://"),
  file_type: z.string().trim().max(100).nullable().optional(),
  file_size: z.number().int().nonnegative().nullable().optional(),
});

router.post("/notes/:id/attachments", validate(idParam, "params"), validate(attachmentBody), wrap(async (req, res) => {
  const id = Number(req.params.id);
  await getNote(id);
  const b = req.body as z.infer<typeof attachmentBody>;
  await pool.query(
    "INSERT INTO Attachment(note_id, file_name, file_url, file_type, file_size) VALUES ($1,$2,$3,$4,$5)",
    [id, b.file_name, b.file_url, b.file_type ?? null, b.file_size ?? null]
  );
  res.status(201).json(await getNote(id));
}));

router.delete("/attachments/:id", validate(idParam, "params"), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM Attachment a USING Note n
      WHERE a.att_id = $1 AND n.note_id = a.note_id AND n.user_id = $2
      RETURNING a.note_id`,
    [req.params.id, USER_ID]
  );
  if (!rows[0]) throw new HttpError(404, "attachment not found");
  res.json(await getNote(rows[0].note_id));
}));