import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

export interface Artist {
  id: string;
  name: string;
  path?: string;
  file_count?: number;
  total_size?: number;
  modified_at?: number;
  albums?: Album[];
  singles?: Single[];
}

export interface Album {
  id: string;
  name: string;
  path: string;
  track_count?: number;
  tracks?: Track[];
}

export interface Track {
  id: string;
  name: string;
  path: string;
  size?: number;
}

export interface Single {
  id: string;
  name: string;
  path: string;
  size?: number;
}

export interface FileTree {
  artists: Artist[];
}

@Injectable({
  providedIn: 'root'
})
export class MusicService {
  private http = inject(HttpClient);
  private baseUrl = 'api';

  artistsChanged = new Subject<Artist[]>();
  artistSelected = new Subject<Artist | null>();

  getArtists(): Observable<Artist[]> {
    return this.http.get<Artist[]>(`${this.baseUrl}/artists`).pipe(
      catchError(error => {
        console.error('Error fetching artists:', error);
        return of([]);
      })
    );
  }

  createArtist(name: string): Observable<Artist> {
    return this.http.post<Artist>(`${this.baseUrl}/artists`, { name }).pipe(
      catchError(error => {
        console.error('Error creating artist:', error);
        throw error;
      })
    );
  }

  deleteArtist(artistId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.baseUrl}/artists/${encodeURIComponent(artistId)}`).pipe(
      catchError(error => {
        console.error('Error deleting artist:', error);
        throw error;
      })
    );
  }

  renameArtist(oldName: string, newName: string): Observable<Artist> {
    return this.http.put<Artist>(`${this.baseUrl}/artists/${encodeURIComponent(oldName)}`, { name: newName }).pipe(
      catchError(error => {
        console.error('Error renaming artist:', error);
        throw error;
      })
    );
  }

  renameAlbum(artistId: string, oldAlbumId: string, newName: string): Observable<Album> {
    return this.http.put<Album>(
      `${this.baseUrl}/artists/${encodeURIComponent(artistId)}/albums/${encodeURIComponent(oldAlbumId)}`,
      { name: newName }
    ).pipe(
      catchError(error => {
        console.error('Error renaming album:', error);
        throw error;
      })
    );
  }

  getArtistDetails(artistId: string): Observable<Artist> {
    return this.http.get<Artist>(`${this.baseUrl}/artists/${encodeURIComponent(artistId)}`).pipe(
      catchError(error => {
        console.error('Error fetching artist details:', error);
        throw error;
      })
    );
  }

  // Download Management
  downloadAlbum(artistId: string, albumName: string, playlistUrl: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/download/album`, {
      artist_id: artistId,
      album_name: albumName,
      playlist_url: playlistUrl
    }).pipe(
      catchError(error => {
        console.error('Error downloading album:', error);
        throw error;
      })
    );
  }

  downloadSingle(artistId: string, videoUrl: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/download/single`, {
      artist_id: artistId,
      video_url: videoUrl
    }).pipe(
      catchError(error => {
        console.error('Error downloading single:', error);
        throw error;
      })
    );
  }

  // File Tree
  getFileTree(): Observable<FileTree> {
    return this.http.get<FileTree>(`${this.baseUrl}/file-tree`).pipe(
      catchError(error => {
        console.error('Error fetching file tree:', error);
        return of({ artists: [] });
      })
    );
  }
}
