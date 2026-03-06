import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { HttpClient } from '@angular/common/http';
import { faPalette, faCheck } from '@fortawesome/free-solid-svg-icons';

interface ColorOption {
  name: string;
  value: string;
}

@Component({
  selector: 'app-accent-color-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, FontAwesomeModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">
        <fa-icon [icon]="faPalette" class="me-2" />
        Accent Color
      </h5>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <div class="color-presets mb-4">
        <label class="form-label mb-3">Preset Colors</label>
        <div class="color-grid">
          @for (color of presetColors; track color.value) {
            <button
              type="button"
              class="color-option"
              [class.active]="selectedColor === color.value"
              [style.background-color]="color.value"
              [title]="color.name"
              (click)="selectColor(color.value)">
              @if (selectedColor === color.value) {
                <fa-icon [icon]="faCheck" class="check-icon" />
              }
            </button>
          }
        </div>
      </div>
      
      <div class="custom-color">
        <label for="customColor" class="form-label">Custom Color</label>
        <div class="input-group">
          <input
            type="color"
            class="form-control form-control-color"
            id="customColor"
            [(ngModel)]="customColorValue"
            (change)="onCustomColorChange()"
            [value]="selectedColor">
          <input
            type="text"
            class="form-control"
            [(ngModel)]="selectedColor"
            (input)="onColorInputChange()"
            placeholder="#0d6efd"
            maxlength="7">
        </div>
      </div>
      
      @if (error) {
        <div class="alert alert-danger mt-3">{{ error }}</div>
      }
      
      <div class="modal-footer mt-4">
        <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()" [disabled]="saving">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" (click)="saveColor()" [disabled]="saving || !isValidColor(selectedColor)">
          @if (saving) {
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
          }
          Save
        </button>
      </div>
    </div>
  `,
  styles: [`
    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .color-option {
      width: 50px;
      height: 50px;
      border: 2px solid var(--bs-border-color);
      border-radius: 0.375rem;
      cursor: pointer;
      position: relative;
      transition: transform 0.2s, border-color 0.2s;
      background: none;
      padding: 0;
    }

    .color-option:hover {
      transform: scale(1.1);
      border-color: var(--bs-primary);
    }

    .color-option.active {
      border-color: var(--bs-primary);
      border-width: 3px;
    }

    .check-icon {
      color: white;
      filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
      font-size: 1.2rem;
    }

    .form-control-color {
      width: 60px;
      height: 38px;
      cursor: pointer;
    }

    .input-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .input-group .form-control {
      flex: 1;
    }
  `]
})
export class AccentColorModalComponent implements OnInit {
  activeModal = inject(NgbActiveModal);
  private http = inject(HttpClient);

  presetColors: ColorOption[] = [
    { name: 'Blue', value: '#0d6efd' },
    { name: 'Purple', value: '#6f42c1' },
    { name: 'Pink', value: '#d63384' },
    { name: 'Red', value: '#dc3545' },
    { name: 'Orange', value: '#fd7e14' },
    { name: 'Yellow', value: '#ffc107' },
    { name: 'Green', value: '#198754' },
    { name: 'Teal', value: '#20c997' },
    { name: 'Cyan', value: '#0dcaf0' },
    { name: 'Indigo', value: '#6610f2' },
    { name: 'Brown', value: '#795548' },
    { name: 'Grey', value: '#6c757d' }
  ];

  selectedColor = '#0d6efd';
  customColorValue = '#0d6efd';
  saving = false;
  error = '';

  faPalette = faPalette;
  faCheck = faCheck;

  ngOnInit() {
    // Load current accent color
    this.http.get<{ color: string }>('api/config/accent-color').subscribe({
      next: (response) => {
        if (response.color) {
          this.selectedColor = response.color;
          this.customColorValue = response.color;
        }
      },
      error: (error) => {
        console.error('Error loading accent color:', error);
      }
    });
  }

  selectColor(color: string) {
    this.selectedColor = color;
    this.customColorValue = color;
    this.error = '';
  }

  onCustomColorChange() {
    this.selectedColor = this.customColorValue;
    this.error = '';
  }

  onColorInputChange() {
    // Validate hex color format
    if (this.isValidColor(this.selectedColor)) {
      this.customColorValue = this.selectedColor;
      this.error = '';
    }
  }

  isValidColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  saveColor() {
    if (!this.isValidColor(this.selectedColor)) {
      this.error = 'Invalid color format. Please use a hex color (e.g., #0d6efd)';
      return;
    }

    this.saving = true;
    this.error = '';

    this.http.put('api/config/accent-color', { color: this.selectedColor }).subscribe({
      next: () => {
        this.saving = false;
        this.activeModal.close(this.selectedColor);
      },
      error: (error) => {
        this.saving = false;
        this.error = error.error?.error || error.error?.msg || 'Failed to save accent color';
      }
    });
  }
}
