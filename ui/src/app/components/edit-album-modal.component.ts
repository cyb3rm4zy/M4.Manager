import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MusicService } from '../services/music.service';
import { Album } from '../services/music.service';

@Component({
  selector: 'app-edit-album-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, FontAwesomeModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Rename Album</h5>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <form (ngSubmit)="onSubmit()">
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
            [disabled]="submitting"
            autofocus>
        </div>
        @if (error) {
          <div class="alert alert-danger">{{ error }}</div>
        }
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()" [disabled]="submitting">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="!albumName.trim() || albumName.trim() === originalName || submitting">
            @if (submitting) {
              <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            }
            Save Changes
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
export class EditAlbumModalComponent implements OnInit {
  @Input() artistId: string = '';
  @Input() album: Album | null = null;

  activeModal = inject(NgbActiveModal);
  private musicService = inject(MusicService);

  get originalName(): string {
    return this.album?.name ?? '';
  }

  albumName = '';
  submitting = false;
  error = '';

  ngOnInit() {
    this.albumName = this.originalName;
  }

  onSubmit() {
    if (!this.albumName.trim() || this.albumName.trim() === this.originalName || !this.album || !this.artistId) {
      return;
    }

    this.submitting = true;
    this.error = '';

    this.musicService.renameAlbum(this.artistId, this.album.id, this.albumName.trim()).subscribe({
      next: (updated) => {
        this.submitting = false;
        this.activeModal.close(updated);
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.error || err.error?.msg || 'Failed to rename album';
      }
    });
  }
}
