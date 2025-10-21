import React, { useState, useEffect } from "react";

export default function Notepad() {
  const STORAGE_KEY = "my_notes";
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setNotes(JSON.parse(saved));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Add or update note
  const saveNote = () => {
    if (!title.trim() || !content.trim()) return alert("Please fill all fields");

    if (editingIndex !== null) {
      const updated = [...notes];
      updated[editingIndex] = { title, content };
      setNotes(updated);
      setEditingIndex(null);
    } else {
      setNotes([{ title, content }, ...notes]);
    }

    setTitle("");
    setContent("");
  };

  // Edit note
  const editNote = (index) => {
    setTitle(notes[index].title);
    setContent(notes[index].content);
    setEditingIndex(index);
  };

  // Delete note
  const deleteNote = (index) => {
    if (window.confirm("Delete this note?")) {
      setNotes(notes.filter((_, i) => i !== index));
    }
  };

  // Share note (mobile share API)
  const shareNote = async (note) => {
    if (navigator.share) {
      await navigator.share({
        title: note.title,
        text: note.content,
      });
    } else {
      alert("Sharing not supported on this browser.");
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📒 My Notepad</h2>

      <input
        type="text"
        placeholder="Note title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={styles.input}
      />
      <textarea
        placeholder="Write your note here..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={styles.textarea}
      />
      <button onClick={saveNote} style={styles.saveBtn}>
        {editingIndex !== null ? "💾 Update Note" : "➕ Save Note"}
      </button>

      <div style={styles.list}>
        {notes.length === 0 ? (
          <p style={{ textAlign: "center", color: "#777" }}>No notes yet...</p>
        ) : (
          notes.map((note, i) => (
            <div key={i} style={styles.card}>
              <h3>{note.title}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{note.content}</p>
              <div style={styles.actions}>
                <button onClick={() => editNote(i)}>✏️ Edit</button>
                <button onClick={() => shareNote(note)}>📤 Share</button>
                <button onClick={() => deleteNote(i)}>🗑️ Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
 <footer className="footer">
        © 2025 WMK Seatrium DC Team
      </footer>
    </div>
  );
}

// === Simple styles ===
const styles = {
  container: {
    maxWidth: 500,
    margin: "40px auto",
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  title: {
    textAlign: "center",
    marginBottom: 16,
    color: "#333",
  },
  input: {
    width: "100%",
    padding: 10,
    fontSize: 16,
    borderRadius: 6,
    border: "1px solid #ccc",
    marginBottom: 10,
  },
  textarea: {
    width: "100%",
    height: 120,
    padding: 10,
    fontSize: 16,
    borderRadius: 6,
    border: "1px solid #ccc",
    resize: "none",
    marginBottom: 10,
  },
  saveBtn: {
    width: "100%",
    background: "#4caf50",
    color: "white",
    padding: 10,
    border: "none",
    borderRadius: 6,
    fontSize: 16,
    cursor: "pointer",
  },
  list: { marginTop: 20 },
  card: {
    background: "#f9f9f9",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    border: "1px solid #ddd",
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 8,
  },
};
