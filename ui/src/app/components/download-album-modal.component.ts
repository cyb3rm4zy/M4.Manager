import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MusicService } from '../services/music.service';

@Component({
  selector: 'app-download-album-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, FontAwesomeModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Download Album</h5>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <form (ngSubmit)="onSubmit()">
        <div class="mb-3">
          <label for="playlistUrl" class="form-label">Playlist URL</label>
          <input 
            type="url" 
            class="form-control" 
            id="playlistUrl"
            [(ngModel)]="playlistUrl"
            name="playlistUrl"
            placeholder="https://www.youtube.com/playlist?list=..."
            required
            [disabled]="submitting"
            autofocus>
          <div class="form-text">Enter a YouTube playlist URL to download as an album.</div>
        </div>
        <div class="mb-3">
          <label for="albumName" class="form-label">Album Name</label>
          <input 
            type="text" 
            class="form-control" 
            id="albumName"
            [(ngModel)]="albumName"
            name="albumName"
            placeholder="Enter album name"
            required
            [disabled]="submitting">
          <div class="form-text">This will create a new folder for the album.</div>
        </div>
        @if (error) {
          <div class="alert alert-danger">{{ error }}</div>
        }
        @if (success) {
          <div class="alert alert-success">Album download started successfully!</div>
        }
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()" [disabled]="submitting">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="!playlistUrl.trim() || !albumName.trim() || submitting">
            @if (submitting) {
              <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            }
            Start Download
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .modal-footer {
      border-top: none;
      padding-top: 0;
    }
  `]
})
export class DownloadAlbumModalComponent {
  @Input() artistId: string = '';

  activeModal = inject(NgbActiveModal);
  private musicService = inject(MusicService);

  playlistUrl = '';
  albumName = '';
  submitting = false;
  error = '';
  success = false;

  onSubmit() {
    if (!this.playlistUrl.trim() || !this.albumName.trim() || !this.artistId) {
      return;
    }

    this.submitting = true;
    this.error = '';
    this.success = false;

    this.musicService.downloadAlbum(this.artistId, this.albumName.trim(), this.playlistUrl.trim()).subscribe({
      next: (response) => {
        this.submitting = false;
        this.success = true;
        setTimeout(() => {
          this.activeModal.close(response);
        }, 1500);
      },
      error: (error) => {
        this.submitting = false;
        this.error = error.error?.msg || error.error?.error || 'Failed to start download';
      }
    });
  }
}
