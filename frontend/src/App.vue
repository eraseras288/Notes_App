<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { api, type Attachment, type Folder, type Note, type Reminder, type Tag } from "./api";

const notes = ref<Note[]>([]);
const folders = ref<Folder[]>([]);
const tags = ref<Tag[]>([]);
const error = ref("");
const search = ref("");
const folderFilter = ref<number | undefined>();
const tagFilter = ref<number | undefined>();

const editingId = ref<number | null>(null); // null = creating a new note
const form = reactive({ title: "", content: "", folder_id: null as number | null, is_pinned: false, tag_ids: [] as number[] });

async function guard(fn: () => Promise<unknown>) {
  error.value = "";
  try { await fn(); } catch (e) { error.value = (e as Error).message; }
}
// черновики полей «добавить напоминание / вложение» для каждой заметки
const drafts = reactive<Record<number, { remind_at: string; name: string; url: string }>>({});
const load = () => guard(async () => {
  const list = await api.notes({ search: search.value, folder_id: folderFilter.value, tag_id: tagFilter.value });
  list.forEach((n) => { drafts[n.note_id] ??= { remind_at: "", name: "", url: "" }; });
  notes.value = list;
});
const replaceNote = (u: Note) => {
  const i = notes.value.findIndex((x) => x.note_id === u.note_id);
  if (i >= 0) notes.value[i] = u;
};
const addReminder = (n: Note) => guard(async () => {
  const d = drafts[n.note_id];
  if (!d.remind_at) throw new Error("Pick a date and time");
  replaceNote(await api.addReminder(n.note_id, d.remind_at));
  d.remind_at = "";
});
const toggleReminder = (r: Reminder) => guard(async () => {
  replaceNote(await api.updateReminder(r.remind_id, { status: r.status === "done" ? "pending" : "done" }));
});
const delReminder = (r: Reminder) => guard(async () => { replaceNote(await api.removeReminder(r.remind_id)); });
const overdue = (r: Reminder) => r.status === "pending" && new Date(r.remind_at).getTime() < Date.now();
const addAttachment = (n: Note) => guard(async () => {
  const d = drafts[n.note_id];
  replaceNote(await api.addAttachment(n.note_id, { file_name: d.name, file_url: d.url }));
  d.name = ""; d.url = "";
});
const delAttachment = (a: Attachment) => guard(async () => { replaceNote(await api.removeAttachment(a.att_id)); });

function resetForm() {
  editingId.value = null;
  Object.assign(form, { title: "", content: "", folder_id: null, is_pinned: false, tag_ids: [] });
}
function edit(n: Note) {
  editingId.value = n.note_id;
  Object.assign(form, {
    title: n.title, content: n.content ?? "", folder_id: n.folder_id,
    is_pinned: n.is_pinned, tag_ids: n.tags.map((t) => t.tag_id),
  });
}
const save = () => guard(async () => {
  const body = { ...form, content: form.content || null };
  if (editingId.value) await api.update(editingId.value, body);
  else await api.create(body);
  resetForm();
  await load();
});
const remove = (n: Note) => guard(async () => {
  if (!confirm(`Delete "${n.title}"?`)) return;
  await api.remove(n.note_id);
  if (editingId.value === n.note_id) resetForm();
  await load();
});
const togglePin = (n: Note) => guard(async () => { await api.update(n.note_id, { is_pinned: !n.is_pinned }); await load(); });
const fmt = (s: string) => new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const newFolder = ref("");
const newTag = ref("");

const addFolder = () => guard(async () => {
  folders.value.push(await api.createFolder(newFolder.value));
  newFolder.value = "";
});
const delFolder = (f: Folder) => guard(async () => {
  if (!confirm(`Delete folder "${f.folder_name}"? Its notes will stay without a folder.`)) return;
  await api.removeFolder(f.folder_id);
  folders.value = folders.value.filter((x) => x.folder_id !== f.folder_id);
  if (folderFilter.value === f.folder_id) folderFilter.value = undefined;
  if (form.folder_id === f.folder_id) form.folder_id = null;
  await load();
});

const addTag = () => guard(async () => {
  tags.value.push(await api.createTag(newTag.value));
  newTag.value = "";
});
const delTag = (t: Tag) => guard(async () => {
  if (!confirm(`Delete tag #${t.tag_name}?`)) return;
  await api.removeTag(t.tag_id);
  tags.value = tags.value.filter((x) => x.tag_id !== t.tag_id);
  form.tag_ids = form.tag_ids.filter((id) => id !== t.tag_id);
  if (tagFilter.value === t.tag_id) tagFilter.value = undefined;
  await load();
});

type Theme = "white" | "beige" | "dark";
const themes: { id: Theme; label: string }[] = [
  { id: "white", label: "White" },
  { id: "beige", label: "Beige" },
  { id: "dark", label: "Black" },
];
const saved = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
const theme = ref<Theme>(
  saved === "white" || saved === "beige" || saved === "dark"
    ? saved
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "white"
);
watch(theme, (t) => {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("theme", t); } catch {}
}, { immediate: true });

let timer: number | undefined;
watch(search, () => { clearTimeout(timer); timer = window.setTimeout(load, 250); });
watch([folderFilter, tagFilter], load);
onMounted(async () => {
  await guard(async () => { [folders.value, tags.value] = await Promise.all([api.folders(), api.tags()]); });
  await load();
});
</script>

<template>
  <div class="layout">
    <aside>
      <h1>Notes</h1>
      <input v-model="search" type="search" placeholder="Search notes" aria-label="Search" />

      <h2>Folders</h2>
      <button :class="{ on: !folderFilter }" @click="folderFilter = undefined">All notes</button>
      <div v-for="f in folders" :key="f.folder_id" class="item">
        <button :class="{ on: folderFilter === f.folder_id }" @click="folderFilter = f.folder_id">{{ f.folder_name }}</button>
        <button class="x" :aria-label="`Delete folder ${f.folder_name}`" @click="delFolder(f)">×</button>
      </div>
      <form class="add" @submit.prevent="addFolder">
        <input v-model="newFolder" placeholder="New folder" aria-label="Folder name" />
        <button>Add</button>
      </form>

      <h2>Tags</h2>
      <button :class="{ on: !tagFilter }" @click="tagFilter = undefined">Any</button>
      <div v-for="t in tags" :key="t.tag_id" class="item">
        <button :class="{ on: tagFilter === t.tag_id }" @click="tagFilter = t.tag_id">#{{ t.tag_name }}</button>
        <button class="x" :aria-label="`Delete tag ${t.tag_name}`" @click="delTag(t)">×</button>
      </div>
      <form class="add" @submit.prevent="addTag">
        <input v-model="newTag" placeholder="New tag" aria-label="Tag name" />
        <button>Add</button>
      </form>

      <div class="themes" role="group" aria-label="Background">
        <button v-for="t in themes" :key="t.id" :class="{ on: theme === t.id }" :aria-pressed="theme === t.id" @click="theme = t.id">{{ t.label }}</button>
      </div>
    </aside>

    <main>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <section class="editor">
        <h2>{{ editingId ? "Editing note" : "New note" }}</h2>
        <input v-model="form.title" placeholder="Title" aria-label="Title" />
        <textarea v-model="form.content" rows="5" placeholder="Note text" aria-label="Text"></textarea>
        <div class="row">
          <select v-model="form.folder_id" aria-label="Folder">
            <option :value="null">No folder</option>
            <option v-for="f in folders" :key="f.folder_id" :value="f.folder_id">{{ f.folder_name }}</option>
          </select>
          <label class="chk"><input type="checkbox" v-model="form.is_pinned" /> Pin</label>
        </div>
        <div class="row">
          <label v-for="t in tags" :key="t.tag_id" class="chk">
            <input type="checkbox" :value="t.tag_id" v-model="form.tag_ids" /> #{{ t.tag_name }}
          </label>
        </div>
        <div class="row">
          <button class="primary" @click="save">{{ editingId ? "Save changes" : "Create note" }}</button>
          <button v-if="editingId" @click="resetForm">Cancel</button>
        </div>
      </section>

      <p v-if="!notes.length" class="empty">No notes yet. Write one in the form above.</p>
      <article v-for="n in notes" :key="n.note_id" :class="{ pinned: n.is_pinned }">
        <header>
          <h3>{{ n.title }}</h3>
          <div class="actions">
            <button @click="togglePin(n)">{{ n.is_pinned ? "Unpin" : "Pin" }}</button>
            <button @click="edit(n)">Edit</button>
            <button class="danger" @click="remove(n)">Delete</button>
          </div>
        </header>
        <p class="text">{{ n.content }}</p>
        <section class="extras">
          <div class="extra">
            <h4>Reminders</h4>
            <ul v-if="n.reminders.length">
              <li v-for="r in n.reminders" :key="r.remind_id" :class="{ done: r.status === 'done', overdue: overdue(r) }">
                <label><input type="checkbox" :checked="r.status === 'done'" @change="toggleReminder(r)" /> {{ fmt(r.remind_at) }}</label>
                <button class="x" aria-label="Delete reminder" @click="delReminder(r)">×</button>
              </li>
            </ul>
            <form class="inline" @submit.prevent="addReminder(n)">
              <input type="datetime-local" v-model="drafts[n.note_id].remind_at" aria-label="Reminder time" />
              <button>Add reminder</button>
            </form>
          </div>
          <div class="extra">
            <h4>Attachments</h4>
            <ul v-if="n.attachments.length">
              <li v-for="a in n.attachments" :key="a.att_id">
                <a :href="a.file_url" target="_blank" rel="noopener noreferrer">{{ a.file_name }}</a>
                <button class="x" aria-label="Delete attachment" @click="delAttachment(a)">×</button>
              </li>
            </ul>
            <form class="inline" @submit.prevent="addAttachment(n)">
              <input v-model="drafts[n.note_id].name" placeholder="File name" aria-label="File name" />
              <input v-model="drafts[n.note_id].url" placeholder="https://..." aria-label="File link" />
              <button>Add link</button>
            </form>
          </div>
        </section>
        <footer>
          <span v-if="n.folder_name">{{ n.folder_name }}</span>
          <span v-for="t in n.tags" :key="t.tag_id" class="tag">#{{ t.tag_name }}</span>
          <time>{{ fmt(n.updated ?? n.created) }}</time>
        </footer>
      </article>
    </main>
  </div>
</template>

<style>
@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap");

/* white (default) */
:root {
  --ink: #1b2433; --ink-2: #26324a; --ink-line: var(--ink-line); --paper: #ffffff; --card: #ffffff;
  --text: #1f2733; --muted: #667085; --line: #dde1e7;
  --accent: #2f5bea; --accent-text: #2f5bea; --rule: #e0524a; --blue-line: #dce6f6;
  --pin: #fff7d1; --pin-edge: #f2c230; --danger: #c0392b;
  --input-bg: #ffffff; --btn-bg: #ffffff; --hover-border: #aab2bf;
  --chip: #eff1f5; --chip-accent: #e4ebfd;
  --error-bg: #fde7e4; --error-line: #f3b9b2;
  color-scheme: light;
  font-family: "DM Sans", system-ui, "Segoe UI", sans-serif; color: var(--text);
}
/* beige */
:root[data-theme="beige"] {
  --ink: #2e2a24; --ink-2: #3d372e; --ink-line: #54493a; --paper: #efe6d6; --card: #fbf6ec;
  --text: #2b2a26; --muted: #7a705f; --line: #d9ccb4;
  --accent: #2f5bea; --accent-text: #2f5bea; --blue-line: #d9dde6;
  --pin: #fbe9a6; --pin-edge: #e0b43a;
  --input-bg: #fffdf8; --btn-bg: #fbf6ec; --hover-border: #bfae8e;
  --chip: #ebe0cb; --chip-accent: #dde4f5;
  --error-bg: #f8ddd5; --error-line: #e8b4a6;
  color-scheme: light;
}
/* black */
:root[data-theme="dark"] {
  --ink: #000000; --ink-2: #17181c; --ink-line: #2a2c33; --paper: #0a0a0b; --card: #15161a;
  --text: #e6e6e8; --muted: #9a9ca5; --line: #2a2c33;
  --accent: #3f68f0; --accent-text: #93b0ff; --rule: #d9554d; --blue-line: #262f45;
  --pin: #2f2a14; --pin-edge: #a8841a; --danger: #ff8a7d;
  --input-bg: #0f1013; --btn-bg: #1d1f25; --hover-border: #484b57;
  --chip: #23252c; --chip-accent: #1f2a48;
  --error-bg: #3a1f1d; --error-line: #6b332e;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); line-height: 1.5; }
h1, h2, h3 { font-family: "Bricolage Grotesque", "DM Sans", system-ui, sans-serif; }
.layout { display: grid; grid-template-columns: 270px 1fr; min-height: 100vh; }

/* sidebar */
aside { background: var(--ink); color: #e6ebf5; padding: 26px 18px; display: flex; flex-direction: column; gap: 4px; }
aside h1 { font-size: 30px; margin: 0 0 16px; color: #fff; letter-spacing: -0.5px; }
aside h2 { font-size: 13px; margin: 22px 0 6px; color: #8e9bb5; font-weight: 600; }
aside input { background: var(--ink-2); border-color: var(--ink-line); color: #fff; }
aside input::placeholder { color: #8e9bb5; }
aside button { text-align: left; background: none; border: 0; color: #cfd7e6; padding: 7px 12px; border-radius: 8px; font: inherit; cursor: pointer; }
aside button:hover { background: var(--ink-2); }
aside button.on { background: var(--accent); color: #fff; }
aside .add button { border: 1px solid var(--ink-line); text-align: center; padding: 6px 10px; }
aside .item .x { color: #8e9bb5; padding: 7px 9px; }
aside .item .x:hover { color: #ff9b91; background: none; }
.item { display: flex; gap: 2px; }
.item > button:first-child { flex: 1; }
.add { display: flex; gap: 6px; margin-top: 6px; }
.add input { min-width: 0; }

.themes { margin-top: auto; padding-top: 18px; display: flex; gap: 4px; }
aside .themes button { flex: 1; text-align: center; border: 1px solid var(--ink-line); padding: 6px 4px; font-size: 13px; }

/* main */
main { padding: 28px; max-width: 820px; width: 100%; display: flex; flex-direction: column; gap: 16px; }
input, textarea, select { font: inherit; padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--input-bg); color: var(--text); width: 100%; }
input[type="checkbox"] { width: auto; accent-color: var(--accent); }
textarea { resize: vertical; }
button { font: inherit; font-weight: 500; padding: 7px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--btn-bg); color: var(--text); cursor: pointer; }
button:hover { border-color: var(--hover-border); }
button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
button.primary:hover { background: #2549c4; }
button.danger { color: var(--danger); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.editor { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.editor h2 { margin: 0; font-size: 20px; }
.row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.row select { width: auto; }
.chk { display: inline-flex; gap: 6px; align-items: center; }

/* index-card notes */
article { background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 14px 18px 12px; box-shadow: 0 1px 0 rgba(27, 36, 51, .06); }
article.pinned { background: var(--pin); border-color: var(--pin-edge); }
article header { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 2px solid var(--rule); }
article h3 { margin: 0; font-size: 21px; letter-spacing: -0.3px; }
.actions { display: flex; gap: 6px; }
.actions button { padding: 4px 10px; font-size: 14px; }
.text { white-space: pre-wrap; margin: 0; padding: 0; min-height: 52px; line-height: 26px;
  background-image: repeating-linear-gradient(transparent 0, transparent 25px, var(--blue-line) 25px, var(--blue-line) 26px); }
article footer { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; color: var(--muted); font-size: 13px; margin-top: 8px; }
footer > span { background: var(--chip); padding: 1px 10px; border-radius: 999px; }
footer .tag { color: var(--accent-text); background: var(--chip-accent); }
footer time { margin-left: auto; }
.error { background: var(--error-bg); border: 1px solid var(--error-line); color: var(--danger); padding: 10px 14px; border-radius: 8px; margin: 0; }
.empty { color: var(--muted); }

.extras { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }
.extra h4 { margin: 0 0 6px; font-size: 14px; color: var(--muted); }
.extra ul { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.extra li { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 14px; }
.extra li.done label { text-decoration: line-through; color: var(--muted); }
.extra li.overdue label { color: var(--danger); }
.extra a { color: var(--accent-text); overflow-wrap: anywhere; }
.extra .x { border: 0; background: none; color: var(--muted); padding: 0 6px; }
.extra .x:hover { color: var(--danger); }
.inline { display: flex; gap: 6px; flex-wrap: wrap; }
.inline input { flex: 1; min-width: 110px; width: auto; padding: 5px 8px; font-size: 14px; }
.inline button { padding: 5px 10px; font-size: 14px; }
@media (max-width: 720px) {
  .extras { grid-template-columns: 1fr; }
  .layout { grid-template-columns: 1fr; }
  aside { padding: 18px; }
  main { padding: 16px; }
}
</style>