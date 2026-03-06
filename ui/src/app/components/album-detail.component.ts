import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { faArrowLeft, faMusic, faDownload, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { MusicService, Album, Track } from '../services/music.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-album-detail',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, NgbModule],
  template: `
    <div class="album-detail">
      <div class="album-header">
        <button 
          class="btn btn-link back-button"
          (click)="goBack()"
          title="Back to artist">
          <fa-icon [icon]="faArrowLeft" class="me-2" />
          Back
        </button>
        <div class="album-header-info">
          <h2 class="album-title">{{ album?.name }}</h2>
          <p class="album-meta text-muted">
            {{ album?.tracks?.length || 0 }} track{{ (album?.tracks?.length || 0) !== 1 ? 's' : '' }}
          </p>
        </div>
      </div>

      @if (loading) {
        <div class="text-center p-5">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      } @else if (tracks && tracks.length > 0) {
        <div class="tracks-list">
          @for (track of tracks; track track.id) {
            <div class="track-item">
              <div class="track-info">
                <div class="track-name">{{ getTrackDisplayName(track.name) }}</div>
                @if (track.size) {
                  <small class="text-muted">{{ formatFileSize(track.size) }}</small>
                }
              </div>
              <div class="track-actions">
                <a 
                  [href]="getTrackDownloadUrl(track)"
                  [download]="track.name"
                  class="btn btn-sm btn-link"
                  title="Download track">
                  <fa-icon [icon]="faDownload" />
                </a>
                <button 
                  class="btn btn-sm btn-link text-danger"
                  (click)="deleteTrack(track)"
                  title="Delete track">
                  <fa-icon [icon]="faTrashAlt" />
                </button>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-section">
          <fa-icon [icon]="faMusic" size="3x" class="text-muted mb-3" />
          <p class="text-muted">No tracks found in this album.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .album-detail {
      flex: 1;
      padding: 2rem;
      overflow: hidden;
      background-color: var(--bs-body-bg);
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .album-header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--bs-border-color);
      flex-shrink: 0;
    }

    .back-button {
      margin-bottom: 1rem;
      padding: 0.5rem 0;
      color: var(--bs-primary);
      text-decoration: none;
    }

    .back-button:hover {
      color: var(--bs-primary);
      text-decoration: underline;
    }

    .album-header-info {
      margin-top: 0.5rem;
    }

    .album-title {
      margin: 0;
      font-size: 2rem;
      font-weight: 600;
    }

    .album-meta {
      margin: 0.5rem 0 0 0;
      font-size: 1rem;
    }

    .empty-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }

    .tracks-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    .track-item {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      background-color: var(--bs-secondary-bg);
      border: 1px solid var(--bs-border-color);
      border-radius: 0.375rem;
      transition: background-color 0.2s;
    }

    .track-item:hover {
      background-color: var(--bs-tertiary-bg);
    }

    .track-info {
      flex: 1;
      min-width: 0;
    }

    .track-name {
      font-size: 0.95rem;
      font-weight: 500;
      margin-bottom: 0.25rem;
      word-break: break-word;
    }

    .track-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
      align-items: center;
    }
  `]
})
export class AlbumDetailComponent implements OnInit, OnChanges {
  @Input() album: Album | null = null;
  @Output() goBackEvent = new EventEmitter<void>();
  @Output() refreshRequested = new EventEmitter<void>();

  private musicService = inject(MusicService);
  private http = inject(HttpClient);

  tracks: Track[] = [];
  loading = false;

  faArrowLeft = faArrowLeft;
  faMusic = faMusic;
  faDownload = faDownload;
  faTrashAlt = faTrashAlt;

  ngOnInit() {
    if (this.album) {
      this.loadAlbumTracks();
    }
  }

  ngOnChanges() {
    if (this.album) {
      this.loadAlbumTracks();
    }
  }

  loadAlbumTracks() {
    if (!this.album) {
      return;
    }

    this.loading = true;
    
    // If album already has tracks loaded, use them
    if (this.album.tracks && this.album.tracks.length > 0) {
      this.tracks = this.album.tracks;
      this.loading = false;
      return;
    }

    // Otherwise, fetch from API
    if (this.album.path) {
      const pathParts = this.album.path.split('/');
      if (pathParts.length >= 2) {
        const artistId = pathParts[0];
        const albumId = pathParts[1];
        
        this.musicService.getArtistDetails(artistId).subscribe({
          next: (artist) => {
            const foundAlbum = artist.albums?.find(a => a.id === albumId);
            if (foundAlbum && foundAlbum.tracks) {
              this.tracks = foundAlbum.tracks;
            } else {
              this.tracks = [];
            }
            this.loading = false;
          },
          error: (error) => {
            console.error('Error loading album tracks:', error);
            this.loading = false;
            this.tracks = [];
          }
        });
      } else {
        this.loading = false;
        this.tracks = [];
      }
    } else {
      this.loading = false;
      this.tracks = [];
    }
  }

  goBack() {
    this.goBackEvent.emit();
  }

  getTrackDisplayName(filename: string): string {
    // Remove file extension for display
    return filename.replace(/\.[^/.]+$/, '');
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getTrackDownloadUrl(track: Track): string {
    // Build download URL based on track path
    // The backend serves audio files from /audio_download/
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    // Encode the path properly for URL
    const encodedPath = track.path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    return `${baseUrl}audio_download/${encodedPath}`;
  }

  deleteTrack(track: Track) {
    if (!confirm(`Delete track "${this.getTrackDisplayName(track.name)}"?`)) {
      return;
    }

    if (!this.album || !this.album.path) {
      return;
    }

    // Extract artist and album from path
    const pathParts = this.album.path.split('/');
    if (pathParts.length < 2) {
      return;
    }

    const artistId = pathParts[0];
    const albumId = pathParts[1];
    
    // Build the full file path
    const trackPath = track.path;
    
    // Delete the file via API
    // For now, we'll use a simple approach - delete the file directly
    // TODO: Add proper API endpoint for deleting tracks
    this.http.delete(`api/artists/${encodeURIComponent(artistId)}/albums/${encodeURIComponent(albumId)}/tracks/${encodeURIComponent(track.id)}`).subscribe({
      next: () => {
        // Update UI immediately
        this.tracks = this.tracks.filter(t => t.id !== track.id);
        // Ask parent to refetch artist so album/track counts stay in sync
        this.refreshRequested.emit();
      },
      error: (error) => {
        console.error('Error deleting track:', error);
        alert('Failed to delete track. You may need to delete it manually from the file system.');
      }
    });
  }
}
