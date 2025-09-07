import React, { useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import { uploadData, getUrl, remove } from 'aws-amplify/storage';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';
import outputs from '../amplify_outputs.json';

// Configure Amplify with the outputs from the backend
Amplify.configure(outputs);

// Generate the data client for GraphQL operations
const client = generateClient();

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <NotesApp signOut={signOut} user={user} />
      )}
    </Authenticator>
  );
}

function NotesApp({ signOut, user }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: null
  });
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Fetch notes when component mounts
  useEffect(() => {
    fetchNotes();
  }, []);

  // Fetch all notes from the API
  const fetchNotes = async () => {
    try {
      setLoading(true);
      const { data: notes } = await client.models.Note.list();
      
      // Get image URLs for notes that have images
      const notesWithImages = await Promise.all(
        notes.map(async (note) => {
          if (note.image) {
            try {
              const imageUrl = await getUrl({ path: note.image });
              return { ...note, imageUrl: imageUrl.url };
            } catch (error) {
              console.error('Error getting image URL:', error);
              return note;
            }
          }
          return note;
        })
      );
      
      setNotes(notesWithImages);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create a new note
  const createNote = async () => {
    if (!formData.name.trim() && !formData.description.trim()) return;

    try {
      setUploading(true);
      let imagePath = null;

      // Upload image if selected
      if (imageFile) {
        const timestamp = Date.now();
        const fileName = `${timestamp}-${imageFile.name}`;
        imagePath = `images/${fileName}`;
        
        await uploadData({
          path: imagePath,
          data: imageFile,
        });
      }

      // Create note in database
      const noteData = {
        name: formData.name || 'Untitled',
        description: formData.description,
        image: imagePath,
      };

      const { data: createdNote } = await client.models.Note.create(noteData);
      
      // Add image URL if image was uploaded
      if (imagePath) {
        const imageUrl = await getUrl({ path: imagePath });
        createdNote.imageUrl = imageUrl.url;
      }

      setNotes([createdNote, ...notes]);
      setFormData({ name: '', description: '', image: null });
      setImageFile(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating note:', error);
    } finally {
      setUploading(false);
    }
  };

  // Delete a note
  const deleteNote = async (noteId, imagePath) => {
    try {
      // Delete the note from database
      await client.models.Note.delete({ id: noteId });
      
      // Delete associated image from storage if it exists
      if (imagePath) {
        try {
          await remove({ path: imagePath });
        } catch (error) {
          console.error('Error deleting image:', error);
        }
      }
      
      setNotes(notes.filter(note => note.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // Update a note
  const updateNote = async (noteId, updatedData) => {
    try {
      const { data: updatedNote } = await client.models.Note.update({
        id: noteId,
        ...updatedData,
      });
      
      setNotes(notes.map(note => 
        note.id === noteId ? { ...note, ...updatedNote } : note
      ));
      setEditingId(null);
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setFormData({ ...formData, image: file.name });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="App-header">
        <div className="header-content">
          <h1>📝 My Notes</h1>
          <p>Built with AWS Amplify & React</p>
          <div className="user-info">
            <span>Welcome!</span>
            <button onClick={signOut} className="sign-out-btn">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Add Note Button */}
        <div className="add-note-section">
          <button
            onClick={() => setIsCreating(true)}
            className="add-note-btn"
            disabled={uploading}
          >
            ➕ Add New Note
          </button>
        </div>

        {/* Create Note Form */}
        {isCreating && (
          <div className="create-note-form">
            <div className="form-header">
              <h3>Create New Note</h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setFormData({ name: '', description: '', image: null });
                  setImageFile(null);
                }}
                className="close-btn"
                disabled={uploading}
              >
                ✕
              </button>
            </div>
            
            <input
              type="text"
              placeholder="Note title..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              disabled={uploading}
            />
            
            <textarea
              placeholder="Write your note here..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="6"
              className="form-textarea"
              disabled={uploading}
            />

            {/* Image Upload */}
            <div className="image-upload">
              <label className="upload-label">
                🖼️ {imageFile ? `Selected: ${imageFile.name}` : 'Choose an image (optional)'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            </div>
            
            <div className="form-actions">
              <button
                onClick={createNote}
                disabled={uploading}
                className="save-btn"
              >
                {uploading ? '💾 Saving...' : '💾 Save Note'}
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setFormData({ name: '', description: '', image: null });
                  setImageFile(null);
                }}
                disabled={uploading}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading notes...</p>
          </div>
        )}

        {/* Notes Grid */}
        {!loading && (
          <div className="notes-grid">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isEditing={editingId === note.id}
                onEdit={() => setEditingId(note.id)}
                onSave={(updatedNote) => updateNote(note.id, updatedNote)}
                onCancel={() => setEditingId(null)}
                onDelete={() => deleteNote(note.id, note.image)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && notes.length === 0 && !isCreating && (
          <div className="empty-state">
            <p>No notes yet. Create your first note!</p>
          </div>
        )}
      </main>
    </div>
  );
}

function NoteCard({ note, isEditing, onEdit, onSave, onCancel, onDelete, formatDate }) {
  const [editName, setEditName] = useState(note.name || '');
  const [editDescription, setEditDescription] = useState(note.description || '');

  const handleSave = () => {
    onSave({ 
      name: editName || 'Untitled', 
      description: editDescription 
    });
  };

  const handleCancel = () => {
    setEditName(note.name || '');
    setEditDescription(note.description || '');
    onCancel();
  };

  if (isEditing) {
    return (
      <div className="note-card editing">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="edit-input"
          placeholder="Note title..."
        />
        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          rows="4"
          className="edit-textarea"
          placeholder="Note description..."
        />
        <div className="edit-actions">
          <button onClick={handleSave} className="save-btn-sm">
            💾 Save
          </button>
          <button onClick={handleCancel} className="cancel-btn-sm">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="note-card">
      <div className="note-header">
        <h3 className="note-title">{note.name || 'Untitled'}</h3>
        <div className="note-actions">
          <button onClick={onEdit} className="edit-btn">
            ✏️
          </button>
          <button onClick={onDelete} className="delete-btn">
            🗑️
          </button>
        </div>
      </div>

      {/* Display image if available */}
      {note.imageUrl && (
        <div className="note-image">
          <img
            src={note.imageUrl}
            alt="Note attachment"
            className="note-img"
          />
        </div>
      )}
      
      <p className="note-description">
        {note.description || 'No description'}
      </p>
      
      <p className="note-date">
        Created: {formatDate(note.createdAt)}
        {note.updatedAt !== note.createdAt && (
          <>
            <br />
            Updated: {formatDate(note.updatedAt)}
          </>
        )}
      </p>
    </div>
  );
}

export default App;
