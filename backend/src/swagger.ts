const id = { name: "id", in: "path", required: true, schema: { type: "integer" } };
const NoteInput = {
  type: "object",
  required: ["title"],
  properties: {
    title: { type: "string", maxLength: 255 },
    content: { type: "string", nullable: true },
    folder_id: { type: "integer", nullable: true },
    is_pinned: { type: "boolean" },
    tag_ids: { type: "array", items: { type: "integer" } },
  },
};
const NameInput = {
  type: "object",
  required: ["name"],
  properties: { name: { type: "string", maxLength: 255 } },
};
const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
const json = (s: object) => ({ "application/json": { schema: s } });
const err = { description: "Error", content: json(ref("Error")) };

export const swaggerSpec = {
  openapi: "3.0.3",
  info: { title: "Notes API", version: "1.0.0", description: "API for working with notes" },
  servers: [{ url: "/api" }],
  paths: {
    "/notes": {
      get: {
        summary: "Notes list",
        parameters: [
          { name: "folder_id", in: "query", schema: { type: "integer" } },
          { name: "tag_id", in: "query", schema: { type: "integer" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "OK", content: json({ type: "array", items: ref("Note") }) }, 400: err },
      },
      post: {
        summary: "Create note",
        requestBody: { required: true, content: json(NoteInput) },
        responses: { 201: { description: "Created", content: json(ref("Note")) }, 400: err },
      },
    },
    "/notes/{id}": {
      parameters: [id],
      get: { summary: "Get note", responses: { 200: { description: "OK", content: json(ref("Note")) }, 404: err } },
      put: {
        summary: "Update note (partially)",
        requestBody: { required: true, content: json({ ...NoteInput, required: [] }) },
        responses: { 200: { description: "OK", content: json(ref("Note")) }, 400: err, 404: err },
      },
      delete: { summary: "Delete note", responses: { 204: { description: "Deleted" }, 404: err } },
    },
    "/notes/{id}/reminders": {
      parameters: [id],
      post: {
        summary: "Add reminder to a note",
        requestBody: { required: true, content: json({ type: "object", required: ["remind_at"], properties: { remind_at: { type: "string", format: "date-time" } } }) },
        responses: { 201: { description: "Updated note", content: json(ref("Note")) }, 400: err, 404: err },
      },
    },
    "/reminders/{id}": {
      parameters: [id],
      put: {
        summary: "Update reminder (status or time)",
        requestBody: { required: true, content: json({ type: "object", properties: { status: { type: "string", enum: ["pending", "done"] }, remind_at: { type: "string", format: "date-time" } } }) },
        responses: { 200: { description: "Updated note", content: json(ref("Note")) }, 400: err, 404: err },
      },
      delete: { summary: "Delete reminder", responses: { 200: { description: "Updated note", content: json(ref("Note")) }, 404: err } },
    },
    "/notes/{id}/attachments": {
      parameters: [id],
      post: {
        summary: "Add attachment (link to a file) to a note",
        requestBody: { required: true, content: json({ type: "object", required: ["file_name", "file_url"], properties: { file_name: { type: "string", maxLength: 255 }, file_url: { type: "string", format: "uri", maxLength: 500 }, file_type: { type: "string", nullable: true }, file_size: { type: "integer", nullable: true } } }) },
        responses: { 201: { description: "Updated note", content: json(ref("Note")) }, 400: err, 404: err },
      },
    },
    "/attachments/{id}": {
      parameters: [id],
      delete: { summary: "Delete attachment", responses: { 200: { description: "Updated note", content: json(ref("Note")) }, 404: err } },
    },
    "/folders": {
      get: { summary: "Folders list", responses: { 200: { description: "OK" } } },
      post: {
        summary: "Create folder",
        requestBody: { required: true, content: json(NameInput) },
        responses: { 201: { description: "Created" }, 400: err },
      },
    },
    "/folders/{id}": {
      parameters: [id],
      delete: { summary: "Delete folder", responses: { 204: { description: "Deleted" }, 404: err } },
    },
    "/tags": {
      get: { summary: "Tags list", responses: { 200: { description: "OK" } } },
      post: {
        summary: "Create tag",
        requestBody: { required: true, content: json(NameInput) },
        responses: { 201: { description: "Created" }, 400: err },
      },
    },
    "/tags/{id}": {
      parameters: [id],
      delete: { summary: "Delete tag", responses: { 204: { description: "Deleted" }, 404: err } },
    },
  },
  components: {
    schemas: {
      Error: { type: "object", properties: { error: { type: "string" }, details: { type: "array", items: { type: "object" } } } },
      Reminder: {
        type: "object",
        properties: {
          remind_id: { type: "integer" }, note_id: { type: "integer" },
          remind_at: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["pending", "done"] },
          created: { type: "string", format: "date-time", nullable: true },
        },
      },
      Attachment: {
        type: "object",
        properties: {
          att_id: { type: "integer" }, note_id: { type: "integer" },
          file_name: { type: "string" }, file_url: { type: "string" },
          file_type: { type: "string", nullable: true }, file_size: { type: "integer", nullable: true },
          uploaded_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      Note: {
        type: "object",
        properties: {
          note_id: { type: "integer" }, title: { type: "string" }, content: { type: "string", nullable: true },
          folder_id: { type: "integer", nullable: true }, folder_name: { type: "string", nullable: true },
          is_pinned: { type: "boolean" }, created: { type: "string", format: "date-time" },
          updated: { type: "string", format: "date-time", nullable: true },
          reminders: { type: "array", items: ref("Reminder") },
          attachments: { type: "array", items: ref("Attachment") },
          tags: { type: "array", items: { type: "object", properties: { tag_id: { type: "integer" }, tag_name: { type: "string" } } } },
        },
      },
    },
  },
};