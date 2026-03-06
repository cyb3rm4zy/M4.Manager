# M4.Manager

A music library manager with a web UI for downloading tracks and albums via [yt-dlp](https://github.com/yt-dlp/yt-dlp). Organise music by artist and album, download from YouTube and [many other sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md), and keep everything in a simple folder structure (artist → album → MP3s).

Forked from [MeTube](https://github.com/alexta69/metube).

---

## Run with Docker

Image tags: `3rm4zy/m4.manager:latest` and `3rm4zy/m4.manager:0.1.0`.

```bash
docker run -d -p 8081:8081 -v /path/to/music:/downloads 3rm4zy/m4.manager:latest
```

Replace `/path/to/music` with your music directory.

## Run with Docker Compose

```yaml
services:
  m4.manager:
    image: 3rm4zy/m4.manager:latest
    container_name: m4.manager
    restart: unless-stopped
    ports:
      - "8081:8081"
    volumes:
      - /path/to/music:/downloads
```

Then open http://localhost:8081.

---

## Configuration (environment variables)

Set these with `-e` when using `docker run`, or under `environment:` in docker-compose.

### Storage and directories

| Variable                  | Description                                              | Default (Docker)         |
|---------------------------|----------------------------------------------------------|--------------------------|
| `DOWNLOAD_DIR`             | Music root (artists/albums live here)                   | `/downloads`             |
| `AUDIO_DOWNLOAD_DIR`      | Audio-only downloads (if different)                     | same as `DOWNLOAD_DIR`   |
| `STATE_DIR`               | Queue/state files (e.g. `.metube`)                      | `/downloads/.metube`     |
| `TEMP_DIR`                | Temp files during download                              | `/downloads`             |

### Web server

| Variable                  | Description                                              | Default                 |
|---------------------------|----------------------------------------------------------|--------------------------|
| `HOST`                    | Bind address                                             | `0.0.0.0`                |
| `PORT`                    | Listen port                                              | `8081`                   |
| `URL_PREFIX`              | Base path (e.g. when behind a reverse proxy)             | `/`                      |

### Downloads (yt-dlp)

| Variable                  | Description                                              | Default                 |
|---------------------------|----------------------------------------------------------|--------------------------|
| `MAX_CONCURRENT_DOWNLOADS`| Max simultaneous downloads                               | `3`                      |
| `YTDL_OPTIONS`            | Extra yt-dlp options (JSON)                             | `{}`                     |
| `YTDL_OPTIONS_FILE`       | Path to JSON file for options                            | (none)                   |

### User and permissions (Docker)

| Variable                  | Description                                              | Default                 |
|---------------------------|----------------------------------------------------------|--------------------------|
| `PUID`                    | Run as this user ID                                      | `1000`                   |
| `PGID`                    | Run as this group ID                                     | `1000`                   |
| `UMASK`                   | Umask for new files                                      | `022`                    |
| `CHOWN_DIRS`              | Chown download/state dirs to PUID:PGID on start           | `true`                   |

### Other

| Variable                  | Description                                              | Default                 |
|---------------------------|----------------------------------------------------------|--------------------------|
| `LOGLEVEL`                | Log level: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`| `INFO`                   |
| `DEFAULT_THEME`           | UI theme: `light`, `dark`, `auto`                         | `auto`                   |

For more options (output templates, HTTPS, public URLs, etc.) the behaviour matches [MeTube](https://github.com/alexta69/metube); see the MeTube wiki and docs for advanced configuration.

---

## Reverse proxy (HTTPS / subpath)

Run behind NGINX, Caddy, or Apache and set `URL_PREFIX` if the app is served under a subpath (e.g. `/m4-manager/`).

Example (NGINX):

```nginx
location /m4-manager/ {
    proxy_pass http://m4-manager:8081/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

Set in the container: `URL_PREFIX=/m4-manager/` (with trailing slash).

---

## License and attribution

Forked from [MeTube](https://github.com/alexta69/metube) (by alexta69). Downloads powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp).
