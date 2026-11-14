import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX) || 240;
const AI_RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX) || 30;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Disable Express server fingerprinting header
app.disable("x-powered-by");

// Restrict JSON body payload size to prevent memory exhaustion DoS
app.use(express.json({ limit: "1mb" }));

// Apply iframe-compatible HTTP security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  next();
});

// Lightweight in-memory rate limiter for /api routes
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function apiRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "local";
    const bucketKey = `${ip}:${maxRequests}`;
    const now = Date.now();
    const entry = rateLimitBuckets.get(bucketKey);
    if (!entry || now > entry.resetAt) {
      rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }
    next();
  };
}

app.use("/api", apiRateLimiter(API_RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS));

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ALLOWED_MOVIE_FIELDS = new Set([
  "title",
  "director",
  "year",
  "rating",
  "lat",
  "lng",
  "date",
  "trend",
  "genre",
]);

function sanitizeString(val: unknown, maxLen = 500, fallback = ""): string {
  if (typeof val !== "string") return fallback;
  return val.trim().slice(0, maxLen);
}

function stripDangerousKeys<T extends Record<string, any>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const clean: Record<string, any> = Object.create(null);
  for (const [k, v] of Object.entries(obj)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    clean[k] = v;
  }
  return { ...clean } as Partial<T>;
}

const DB_FILE = path.resolve(process.cwd(), process.env.DB_FILE_PATH || "db.json");

const defaultMovies = [
  { id: 1, title: "Beetlejuice", year: "1988", director: "Tim Burton", lat: 34.0522, lng: -118.2437, date: "2026-06-25", trend: [45, 52, 49, 63, 58, 67, 72, 85, 78, 92], rating: 4.2 },
  { id: 2, title: "Ghostbusters", year: "1984", director: "Ivan Reitman", lat: 40.7128, lng: -74.0060, date: "2026-06-26", trend: [68, 72, 70, 78, 85, 82, 89, 94, 91, 98], rating: 4.5 },
  { id: 3, title: "The Matrix", year: "1999", director: "Lana Wachowski, Lilly Wachowski", lat: -33.8688, lng: 151.2093, date: "2026-06-24", trend: [95, 92, 90, 88, 85, 82, 80, 83, 85, 89], rating: 4.9 },
  { id: 4, title: "Inception", year: "2010", director: "Christopher Nolan", lat: 51.5074, lng: -0.1278, date: "2026-06-25", trend: [75, 78, 82, 80, 85, 89, 93, 91, 95, 99], rating: 4.8 },
  { id: 5, title: "Interstellar", year: "2014", director: "Christopher Nolan", lat: 64.1466, lng: -21.9426, date: "2026-06-26", trend: [80, 83, 85, 84, 88, 90, 92, 95, 98, 102], rating: 4.7 },
  { id: 6, title: "Pulp Fiction", year: "1994", director: "Quentin Tarantino", lat: 34.0522, lng: -118.2437, date: "2026-06-24", trend: [90, 88, 85, 87, 82, 80, 78, 75, 79, 82], rating: 4.9 },
  { id: 7, title: "The Shawshank Redemption", year: "1994", director: "Frank Darabont", lat: 40.7587, lng: -82.5221, date: "2026-06-25", trend: [98, 99, 100, 97, 98, 99, 100, 99, 100, 102], rating: 5.0 },
  { id: 8, title: "The Godfather", year: "1972", director: "Francis Ford Coppola", lat: 40.7128, lng: -74.0060, date: "2026-06-26", trend: [92, 94, 93, 95, 91, 90, 92, 94, 93, 96], rating: 5.0 },
  { id: 9, title: "The Dark Knight", year: "2008", director: "Christopher Nolan", lat: 41.8781, lng: -87.6298, date: "2026-06-24", trend: [88, 90, 92, 95, 93, 96, 98, 100, 99, 104], rating: 4.9 },
  { id: 10, title: "Schindler's List", year: "1993", director: "Steven Spielberg", lat: 50.0647, lng: 19.9450, date: "2026-06-25", trend: [70, 72, 75, 73, 78, 80, 82, 85, 84, 88], rating: 4.9 },
  { id: 11, title: "Forrest Gump", year: "1994", director: "Robert Zemeckis", lat: 32.0809, lng: -81.0912, date: "2026-06-26", trend: [85, 84, 86, 88, 89, 91, 93, 92, 95, 97], rating: 4.6 },
  { id: 12, title: "Star Wars: Episode V", year: "1980", director: "Irvin Kershner", lat: 60.5518, lng: -6.4080, date: "2026-06-24", trend: [78, 82, 80, 85, 89, 87, 91, 95, 93, 98], rating: 4.8 },
  { id: 13, title: "Goodfellas", year: "1990", director: "Martin Scorsese", lat: 40.7128, lng: -74.0060, date: "2026-06-25", trend: [82, 80, 83, 85, 82, 81, 84, 88, 86, 90], rating: 4.7 },
  { id: 14, title: "The Lord of the Rings: The Return of the King", year: "2003", director: "Peter Jackson", lat: -41.2865, lng: 174.7762, date: "2026-06-26", trend: [94, 96, 95, 98, 97, 99, 100, 102, 101, 105], rating: 4.9 },
  { id: 15, title: "Spirited Away", year: "2001", director: "Hayao Miyazaki", lat: 35.6762, lng: 139.6503, date: "2026-06-24", trend: [72, 75, 78, 76, 80, 83, 85, 89, 87, 92], rating: 4.5 }
];

function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initialDb = {
      movies: defaultMovies,
      savedViews: [],
      comments: [],
      bookmarks: [],
      auditLogs: [
        {
          id: "seed-log",
          timestamp: new Date().toISOString(),
          action: "Database Initialized",
          details: "Standard movie dataset loaded with 15 initial entries."
        }
      ],
      themes: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf8");
    return initialDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("DB read error, returning default data:", err);
    return {
      movies: defaultMovies,
      savedViews: [],
      comments: [],
      bookmarks: [],
      auditLogs: [],
      themes: []
    };
  }
}

function saveDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("DB write error:", err);
  }
}

function addAuditLog(action: string, details: string) {
  const db = getDb();
  const log = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    action: sanitizeString(action, 120, "Action"),
    details: sanitizeString(details, 500, "")
  };
  db.auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 100) {
    db.auditLogs = db.auditLogs.slice(0, 100);
  }
  saveDb(db);
}

// REST API Endpoints

// 1. Movies Grid Data (Supports search, filtering, server-side sorting, pagination)
app.get("/api/movies", async (req, res) => {
  try {
    const db = getDb();
    let moviesList = [...(Array.isArray(db.movies) ? db.movies : defaultMovies)];

    const { page, limit, search, sortBy, sortOrder, ratingFilter, aiQuery } = req.query;

    // AI Natural Language Query Processing if requested
    const safeAiQuery = sanitizeString(aiQuery, 300);
    if (safeAiQuery && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ 
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        
        const prompt = `Based on the user natural language query ${JSON.stringify(safeAiQuery)}, parse it into a set of structured filtering conditions.
The fields are:
- title (string)
- director (string)
- year (string representation of number)
- rating (number)

Return ONLY a JSON object representing the criteria:
{
  "search": string (or empty),
  "minYear": number (or null),
  "maxYear": number (or null),
  "minRating": number (or null),
  "maxRating": number (or null),
  "director": string (or empty)
}
Return only raw JSON, no markdown codeblocks, no extra explanations.`;

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            systemInstruction: "You are an intelligent SQL/NoSQL filter translator. Translate user statements to exact JSON filter specs."
          }
        });

        const filterSpec = JSON.parse(response.text || "{}");
        
        if (filterSpec.search) {
          const s = String(filterSpec.search).toLowerCase();
          moviesList = moviesList.filter(m => String(m.title || "").toLowerCase().includes(s));
        }
        if (filterSpec.minYear) {
          moviesList = moviesList.filter(m => Number(m.year) >= Number(filterSpec.minYear));
        }
        if (filterSpec.maxYear) {
          moviesList = moviesList.filter(m => Number(m.year) <= Number(filterSpec.maxYear));
        }
        if (filterSpec.minRating) {
          moviesList = moviesList.filter(m => m.rating >= Number(filterSpec.minRating));
        }
        if (filterSpec.maxRating) {
          moviesList = moviesList.filter(m => m.rating <= Number(filterSpec.maxRating));
        }
        if (filterSpec.director) {
          const d = String(filterSpec.director).toLowerCase();
          moviesList = moviesList.filter(m => String(m.director || "").toLowerCase().includes(d));
        }
        addAuditLog("AI Query Applied", `AI query "${safeAiQuery}" parsed successfully as ${JSON.stringify(filterSpec)}`);
      } catch (aiErr) {
        console.error("AI filter error, falling back to manual filters:", aiErr);
      }
    }

    // Manual Local Searching
    if (search) {
      const s = sanitizeString(search, 200).toLowerCase();
      moviesList = moviesList.filter(
        m => String(m.title || "").toLowerCase().includes(s) || 
             String(m.director || "").toLowerCase().includes(s) || 
             String(m.year || "").includes(s)
      );
    }

    // Rating filter
    if (ratingFilter) {
      const minRating = Number(ratingFilter);
      if (!Number.isNaN(minRating)) {
        moviesList = moviesList.filter(m => Number(m.rating) >= minRating);
      }
    }

    // Sorting (guard against prototype property access)
    if (sortBy) {
      const key = String(sortBy);
      if (!DANGEROUS_KEYS.has(key) && ALLOWED_MOVIE_FIELDS.has(key)) {
        const isAsc = String(sortOrder).toLowerCase() !== "desc";
        moviesList.sort((a: any, b: any) => {
          const valA = a[key];
          const valB = b[key];
          if (typeof valA === "string") {
            return isAsc ? valA.localeCompare(String(valB ?? "")) : String(valB ?? "").localeCompare(valA);
          }
          return isAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
        });
      }
    }

    const totalCount = moviesList.length;

    // Pagination (clamp page & limit)
    const p = Math.max(1, Math.min(1000, Number(page) || 1));
    const l = Math.max(1, Math.min(100, Number(limit) || 10));
    const startIdx = (p - 1) * l;
    const paginatedList = moviesList.slice(startIdx, startIdx + l);

    res.json({
      data: paginatedList,
      totalCount,
      page: p,
      limit: l
    });
  } catch (error: any) {
    console.error("Fetch movies error:", error);
    res.status(500).json({ error: "Failed to fetch movies" });
  }
});

// Create Movie
app.post("/api/movies", (req, res) => {
  try {
    const db = getDb();
    const movie = stripDangerousKeys(req.body || {});
    db.movies = Array.isArray(db.movies) ? db.movies : [];
    if (db.movies.length >= 500) {
      return res.status(400).json({ error: "Maximum movie limit reached in demo database." });
    }
    
    const newId = db.movies.length > 0 ? Math.max(...db.movies.map((m: any) => Number(m.id) || 0)) + 1 : 1;
    const newMovie = {
      id: newId,
      title: sanitizeString(movie.title, 200, "Untitled Film"),
      director: sanitizeString(movie.director, 200, "Unknown Director"),
      year: sanitizeString(String(movie.year ?? ""), 10, new Date().getFullYear().toString()),
      rating: Math.max(0, Math.min(5, Number(movie.rating) || 4.0)),
      lat: Math.max(-90, Math.min(90, Number(movie.lat) || 34.0522)),
      lng: Math.max(-180, Math.min(180, Number(movie.lng) || -118.2437)),
      date: sanitizeString(movie.date, 30, new Date().toISOString().split("T")[0]),
      trend: Array.isArray(movie.trend)
        ? movie.trend.slice(0, 20).map((n: any) => Number(n) || 0)
        : [50, 50, 50, 50, 50],
    };

    db.movies.push(newMovie);
    saveDb(db);

    addAuditLog("Row Created", `Movie "${newMovie.title}" (ID: ${newId}) created via server-side API.`);
    res.status(201).json(newMovie);
  } catch (error: any) {
    console.error("Create movie error:", error);
    res.status(500).json({ error: "Failed to create movie" });
  }
});

// Update Movie
app.put("/api/movies/:id", (req, res) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid movie ID" });
    }
    const rawUpdates = stripDangerousKeys(req.body || {});
    const safeUpdates: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawUpdates)) {
      if (!ALLOWED_MOVIE_FIELDS.has(key)) continue;
      if (key === "title" || key === "director" || key === "genre") {
        safeUpdates[key] = sanitizeString(String(val ?? ""), 200);
      } else if (key === "year" || key === "date") {
        safeUpdates[key] = sanitizeString(String(val ?? ""), 30);
      } else if (key === "rating" || key === "lat" || key === "lng") {
        const num = Number(val);
        if (!Number.isNaN(num)) safeUpdates[key] = num;
      } else if (key === "trend" && Array.isArray(val)) {
        safeUpdates[key] = val.slice(0, 20).map((n: any) => Number(n) || 0);
      }
    }

    const movieIdx = db.movies.findIndex((m: any) => m.id === id);
    if (movieIdx === -1) {
      return res.status(404).json({ error: "Movie not found" });
    }

    const originalMovie = db.movies[movieIdx];
    const updatedMovie = {
      ...originalMovie,
      ...safeUpdates,
      id // Prevent ID modification
    };

    db.movies[movieIdx] = updatedMovie;
    saveDb(db);

    addAuditLog("Row Updated", `Movie "${updatedMovie.title}" (ID: ${id}) fields changed: ${JSON.stringify(safeUpdates)}`);
    res.json(updatedMovie);
  } catch (error: any) {
    console.error("Update movie error:", error);
    res.status(500).json({ error: "Failed to update movie" });
  }
});

// Delete Movie
app.delete("/api/movies/:id", (req, res) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid movie ID" });
    }

    const movie = db.movies.find((m: any) => m.id === id);
    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }

    db.movies = db.movies.filter((m: any) => m.id !== id);
    saveDb(db);

    addAuditLog("Row Deleted", `Movie "${movie.title}" (ID: ${id}) removed from database.`);
    res.json({ success: true, message: "Movie deleted successfully" });
  } catch (error: any) {
    console.error("Delete movie error:", error);
    res.status(500).json({ error: "Failed to delete movie" });
  }
});

// 2. Saved Views & Shareable Views
app.get("/api/saved-views", (req, res) => {
  const db = getDb();
  res.json(db.savedViews || []);
});

app.get("/api/saved-views/:id", (req, res) => {
  const db = getDb();
  const view = (db.savedViews || []).find((v: any) => v.id === req.params.id);
  if (!view) {
    return res.status(404).json({ error: "Saved view not found" });
  }
  res.json(view);
});

app.post("/api/saved-views", (req, res) => {
  try {
    const db = getDb();
    const cleanName = sanitizeString(req.body?.name, 120);
    const cleanState = stripDangerousKeys(req.body?.state || {});
    
    if (!cleanName) return res.status(400).json({ error: "View name required" });

    const viewId = `view-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newView = { id: viewId, name: cleanName, state: cleanState };

    db.savedViews = Array.isArray(db.savedViews) ? db.savedViews : [];
    db.savedViews.push(newView);
    if (db.savedViews.length > 100) {
      db.savedViews = db.savedViews.slice(-100);
    }
    saveDb(db);

    addAuditLog("View Saved", `Saved View layout "${cleanName}" was created on the server.`);
    res.status(201).json(newView);
  } catch (error: any) {
    console.error("Save view error:", error);
    res.status(500).json({ error: "Failed to save view" });
  }
});

// 3. Comments & Mentions
app.get("/api/comments/:rowId", (req, res) => {
  const db = getDb();
  const rowId = sanitizeString(req.params.rowId, 64);
  const comments = (db.comments || []).filter((c: any) => String(c.rowId) === rowId);
  res.json(comments);
});

app.post("/api/comments/:rowId", (req, res) => {
  try {
    const db = getDb();
    const rowId = sanitizeString(req.params.rowId, 64);
    const cleanAuthor = sanitizeString(req.body?.author, 80, "Anonymous User");
    const cleanText = sanitizeString(req.body?.text, 1000);

    if (!cleanText) return res.status(400).json({ error: "Comment text is required" });

    const newComment = {
      id: `comment-${Date.now()}`,
      rowId,
      author: cleanAuthor,
      text: cleanText,
      timestamp: new Date().toISOString()
    };

    db.comments = Array.isArray(db.comments) ? db.comments : [];
    db.comments.push(newComment);
    if (db.comments.length > 500) {
      db.comments = db.comments.slice(-500);
    }
    saveDb(db);

    addAuditLog("Comment Posted", `New comment added on row ID ${rowId} by ${newComment.author}.`);
    res.status(201).json(newComment);
  } catch (error: any) {
    console.error("Post comment error:", error);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// 3.5 Bookmarks
app.get("/api/bookmarks", (req, res) => {
  const db = getDb();
  res.json(db.bookmarks || []);
});

app.post("/api/bookmarks", (req, res) => {
  try {
    const db = getDb();
    const key = req.body?.key;
    if (key === undefined || key === null) return res.status(400).json({ error: "Key required" });

    const keys = new Set<string>(Array.isArray(db.bookmarks) ? db.bookmarks : []);
    const sKey = sanitizeString(String(key), 100);
    if (!sKey) return res.status(400).json({ error: "Valid key required" });
    
    if (keys.has(sKey)) {
      keys.delete(sKey);
    } else if (keys.size < 500) {
      keys.add(sKey);
    }
    
    db.bookmarks = Array.from(keys);
    saveDb(db);
    res.json({ bookmarks: db.bookmarks });
  } catch (error: any) {
    console.error("Bookmark error:", error);
    res.status(500).json({ error: "Failed to update bookmark" });
  }
});

// 4. Audit Trail Log fetching
app.get("/api/audit-trail", (req, res) => {
  const db = getDb();
  res.json(db.auditLogs || []);
});

// Write to Audit Trail
app.post("/api/audit-trail", (req, res) => {
  try {
    const action = sanitizeString(req.body?.action, 120);
    const details = sanitizeString(req.body?.details, 500);
    if (!action || !details) return res.status(400).json({ error: "Action & details required" });
    addAuditLog(action, details);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Audit log error:", error);
    res.status(500).json({ error: "Failed to record audit entry" });
  }
});

// 5. Offline Queue Synchronizer (Protected against Prototype Pollution)
app.post("/api/sync", (req, res) => {
  try {
    const db = getDb();
    const { actions } = req.body || {};

    if (!actions || !Array.isArray(actions)) {
      return res.status(400).json({ error: "Invalid actions array" });
    }

    let syncCount = 0;
    for (const change of actions.slice(0, 200)) {
      if (!change || typeof change !== "object") continue;
      const colId = String(change.columnId || "");
      if (DANGEROUS_KEYS.has(colId) || !ALLOWED_MOVIE_FIELDS.has(colId)) {
        continue;
      }
      const rowId = Number(change.rowId);
      const movieIdx = db.movies.findIndex((m: any) => m.id === rowId);
      if (movieIdx !== -1) {
        db.movies[movieIdx][colId] =
          typeof change.newValue === "string"
            ? sanitizeString(change.newValue, 200)
            : change.newValue;
        syncCount++;
      }
    }

    saveDb(db);
    addAuditLog("Offline Sync Completed", `Reconciled ${syncCount} offline edits from sync client queue.`);

    res.json({ success: true, count: syncCount, movies: db.movies });
  } catch (error: any) {
    console.error("Offline sync error:", error);
    res.status(500).json({ error: "Failed to synchronize offline edits" });
  }
});

// 6. Theme Configurations
app.get("/api/themes", (req, res) => {
  const db = getDb();
  res.json(db.themes || []);
});

app.post("/api/themes", (req, res) => {
  try {
    const db = getDb();
    const name = sanitizeString(req.body?.name, 80, "custom-theme");
    const themeData = stripDangerousKeys(req.body?.themeData || {});

    const newTheme = { id: `theme-${Date.now()}`, name, themeData };
    db.themes = Array.isArray(db.themes) ? db.themes : [];
    db.themes.push(newTheme);
    if (db.themes.length > 50) {
      db.themes = db.themes.slice(-50);
    }
    saveDb(db);

    addAuditLog("Theme Created", `Custom design theme "${name}" was created and saved.`);
    res.status(201).json(newTheme);
  } catch (error: any) {
    console.error("Save theme error:", error);
    res.status(500).json({ error: "Failed to save theme" });
  }
});

// AI Proxy endpoints (rate-limited & input-bounded)
const aiLimiter = apiRateLimiter(AI_RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

app.post("/api/insights", aiLimiter, async (req, res) => {
  try {
    const { data, title } = req.body || {};
    const safeTitle = sanitizeString(title, 120, "the dataset");
    const serializedData = JSON.stringify(data ?? []).slice(0, 5000);
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Analyze the following grid data for "${safeTitle}" and provide brief insights, data trends, and a short summary (max 3 sentences). Format as plain text or markdown.\n\nData: ${serializedData}`,
      config: {
        systemInstruction: "You are a professional data analyst. Provide clear, concise insights for the provided data."
      }
    });
    
    res.json({ insights: response.text });
  } catch (error: any) {
    console.error("AI Insight Error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

app.post("/api/ai-query", aiLimiter, async (req, res) => {
  try {
    const safeQuery = sanitizeString(req.body?.query, 300);
    if (!safeQuery) {
      return res.status(400).json({ error: "Query is required" });
    }
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Given the user query ${JSON.stringify(safeQuery)}, parse it into a JSON object representing filter parameters for a dataset.
Return a JSON object containing any relevant filter keys such as:
- 'title' (string)
- 'director' (string)
- 'department' (string)
- 'role' (string)
- 'minYear' (number)
- 'maxYear' (number)
- 'minRating' (number)
- 'maxRating' (number)
- 'minSalary' (number)
- 'maxSalary' (number)

Return ONLY valid JSON, without any markdown formatting or extra text.`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are a data filtering assistant. Convert natural language queries into structured JSON filter parameters."
      }
    });
    
    const filterParams = JSON.parse(response.text || '{}');
    res.json(stripDangerousKeys(filterParams));
  } catch (error: any) {
    console.error("AI Query Error:", error);
    res.status(500).json({ error: "Failed to parse query" });
  }
});

app.post("/api/ai-summary", aiLimiter, async (req, res) => {
  try {
    const serializedData = JSON.stringify(req.body?.data ?? []).slice(0, 6000);
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Please provide a brief, 2-3 sentence executive summary of the following data:\n\n${serializedData}`,
      config: {
        systemInstruction: "You are an expert data analyst. Provide a concise, professional summary of the provided data."
      }
    });
    
    res.json({ summary: response.text });
  } catch (error: any) {
    console.error("AI Summary Error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

app.post("/api/ai-insights", aiLimiter, async (req, res) => {
  try {
    const serializedData = JSON.stringify(req.body?.data ?? []).slice(0, 6000);
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Analyze this data and provide 3-4 key business insights. Return ONLY a JSON array of objects with keys: "title" (short), "value" (the metric/number), "trend" ('up', 'down', or 'neutral'), "description" (1 short sentence).\n\nData: ${serializedData}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are an expert data analyst. Extract key metrics and trends from data."
      }
    });
    
    const insights = JSON.parse(response.text || '[]');
    res.json(Array.isArray(insights) ? insights : []);
  } catch (error: any) {
    console.error("AI Insights Error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

// Universal Server-Side LLM Proxy Route for @enterprisegrid/grid
// Automatically uses server environment variables (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, CUSTOM_LLM_API_KEY)
app.post("/api/llm", aiLimiter, async (req, res) => {
  try {
    const provider = sanitizeString(req.body?.provider, 32, "gemini").toLowerCase();
    const requestedModel = sanitizeString(req.body?.model, 80);
    const safePrompt = sanitizeString(req.body?.prompt, 8000, "Analyze the provided dataset.");
    const safeSystem = sanitizeString(
      req.body?.systemInstruction,
      1000,
      "You are an enterprise data grid intelligence engine."
    );
    const task = sanitizeString(req.body?.task, 32);

    if ((provider === "openai" && process.env.OPENAI_API_KEY) || (provider === "openrouter" && process.env.OPENROUTER_API_KEY) || provider === "ollama") {
      const url =
        provider === "ollama"
          ? process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1/chat/completions"
          : provider === "openrouter"
          ? process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions"
          : process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";
      const apiKey =
        provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: requestedModel || (provider === "ollama" ? "llama3.2" : "gpt-4o-mini"),
          temperature: 0.1,
          messages: [
            { role: "system", content: safeSystem },
            { role: "user", content: safePrompt },
          ],
        }),
      });
      if (!upstream.ok) throw new Error(`Upstream provider HTTP ${upstream.status}`);
      const json: any = await upstream.json();
      return res.json({ text: json.choices?.[0]?.message?.content || json.text || "" });
    }

    if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      const url = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1/messages";
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: requestedModel || "claude-3-5-haiku-latest",
          max_tokens: 1024,
          system: safeSystem,
          messages: [{ role: "user", content: safePrompt }],
        }),
      });
      if (!upstream.ok) throw new Error(`Anthropic HTTP ${upstream.status}`);
      const json: any = await upstream.json();
      return res.json({ text: json.content?.[0]?.text || "" });
    }

    if (provider === "custom" && process.env.CUSTOM_LLM_ENDPOINT) {
      const upstream = await fetch(process.env.CUSTOM_LLM_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CUSTOM_LLM_API_KEY
            ? { Authorization: `Bearer ${process.env.CUSTOM_LLM_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          model: requestedModel || "default",
          prompt: safePrompt,
          systemInstruction: safeSystem,
          task,
        }),
      });
      if (!upstream.ok) throw new Error(`Custom LLM HTTP ${upstream.status}`);
      const json: any = await upstream.json();
      return res.json({ text: json.text || json.answer || json.summary || JSON.stringify(json) });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const response = await ai.models.generateContent({
      model: requestedModel && provider === "gemini" ? requestedModel : GEMINI_MODEL,
      contents: safePrompt,
      config: {
        ...(task === "query" || task === "insights" ? { responseMimeType: "application/json" } : {}),
        systemInstruction: safeSystem
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Universal LLM Route Error:", error);
    res.status(500).json({ error: "Failed to execute LLM request" });
  }
});

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

// Serve static files from the public directory
app.use(express.static(PUBLIC_DIR));

// Explicit route for .tgz package downloads with strict filename & path traversal validation
app.get("/*.tgz", (req, res, next) => {
  const fileName = path.basename(req.path).replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = path.resolve(PUBLIC_DIR, fileName);
  if (filePath.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.sendFile(filePath);
  }
  next();
});

// Explicit route for .zip package downloads with strict filename & path traversal validation
app.get("/*.zip", (req, res, next) => {
  const fileName = path.basename(req.path).replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = path.resolve(PUBLIC_DIR, fileName);
  if (filePath.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.sendFile(filePath);
  }
  next();
});

// Ensure unknown /api/* routes return JSON 404 instead of SPA HTML fallback,
// while allowing direct browser HTML navigation to the /api documentation route.
app.use("/api", (req, res, next) => {
  if (req.path === "/" && req.method === "GET" && req.accepts("html")) {
    return next();
  }
  res.status(404).json({ error: "API route not found" });
});

// Vite middleware and server startup wrapped in async run to allow CommonJS builds
async function run() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1d',
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.match(/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

run().catch((err) => {
  console.error("Failed to start server:", err);
});
