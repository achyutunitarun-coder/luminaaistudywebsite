export interface GoogleCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface GoogleApiResult {
  success: boolean;
  url?: string;
  id?: string;
  error?: string;
}

const GOOGLE_SCOPES = {
  slides: "https://www.googleapis.com/auth/presentations",
  docs: "https://www.googleapis.com/auth/documents",
  sheets: "https://www.googleapis.com/auth/spreadsheets",
  drive: "https://www.googleapis.com/auth/drive.file",
};

function getCredentials(): GoogleCredentials | null {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleCredentials;
  } catch {
    return null;
  }
}

async function getAccessToken(scope: string): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtClaim = {
    iss: creds.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const b64url = (obj: any) => btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${b64url(jwtHeader)}.${b64url(jwtClaim)}`;

  try {
    const keyData = creds.private_key;
    const pemContents = keyData.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
    const rawKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      "pkcs8",
      rawKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const sig = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      new TextEncoder().encode(signatureInput),
    );

    const signature = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const jwt = `${signatureInput}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("[google-api] token fetch failed:", err);
      return null;
    }

    const data = await res.json();
    return data.access_token ?? null;
  } catch (e) {
    console.warn("[google-api] JWT signing failed:", e);
    return null;
  }
}

export async function createGoogleSlides(title: string, content?: string): Promise<GoogleApiResult> {
  const token = await getAccessToken(`${GOOGLE_SCOPES.slides} ${GOOGLE_SCOPES.drive}`);
  if (!token) return { success: false, error: "Google credentials not configured or auth failed" };

  try {
    const createRes = await fetch("https://slides.googleapis.com/v1/presentations", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!createRes.ok) return { success: false, error: `Create failed: ${await createRes.text()}` };

    const presentation = await createRes.json();
    const presentationId = presentation.presentationId;

    if (content) {
      const requests = [
        { deleteObject: { objectId: presentation.slides?.[0]?.objectId } },
        {
          createSlide: {
            objectId: "title_slide",
            insertionIndex: 0,
            slideLayoutReference: { predefinedLayout: "TITLE" },
            placeholderId: "title",
          },
        },
      ];
      await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      });
    }

    return { success: true, id: presentationId, url: `https://docs.google.com/presentation/d/${presentationId}/edit` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createGoogleDoc(title: string, markdown?: string): Promise<GoogleApiResult> {
  const token = await getAccessToken(`${GOOGLE_SCOPES.docs} ${GOOGLE_SCOPES.drive}`);
  if (!token) return { success: false, error: "Google credentials not configured or auth failed" };

  try {
    const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!createRes.ok) return { success: false, error: `Create failed: ${await createRes.text()}` };

    const doc = await createRes.json();
    const docId = doc.documentId;

    if (markdown) {
      const requests: any[] = [];
      const lines = markdown.split("\n");
      let requestIndex = 1;
      for (const line of lines) {
        if (line.startsWith("# ")) {
          requests.push({ insertText: { location: { index: requestIndex }, text: `${line.slice(2)}\n` } });
          requests.push({ updateParagraphStyle: { range: { startIndex: requestIndex, endIndex: requestIndex + line.length - 1 }, paragraphStyle: { namedStyleType: "HEADING_1" }, fields: "namedStyleType" } });
          requestIndex += line.length - 1;
        } else if (line.startsWith("## ")) {
          requests.push({ insertText: { location: { index: requestIndex }, text: `${line.slice(3)}\n` } });
          requests.push({ updateParagraphStyle: { range: { startIndex: requestIndex, endIndex: requestIndex + line.length - 2 }, paragraphStyle: { namedStyleType: "HEADING_2" }, fields: "namedStyleType" } });
          requestIndex += line.length - 2;
        } else if (line.trim()) {
          requests.push({ insertText: { location: { index: requestIndex }, text: `${line}\n` } });
          requestIndex += line.length + 1;
        }
      }
      if (requests.length > 0) {
        await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requests }),
        });
      }
    }

    return { success: true, id: docId, url: `https://docs.google.com/document/d/${docId}/edit` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createGoogleSheet(title: string, csvData?: string): Promise<GoogleApiResult> {
  const token = await getAccessToken(`${GOOGLE_SCOPES.sheets} ${GOOGLE_SCOPES.drive}`);
  if (!token) return { success: false, error: "Google credentials not configured or auth failed" };

  try {
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: { title }, sheets: [{ properties: { title: "Sheet1" } }] }),
    });
    if (!createRes.ok) return { success: false, error: `Create failed: ${await createRes.text()}` };

    const sheet = await createRes.json();
    const sheetId = sheet.spreadsheetId;

    if (csvData) {
      const rows = csvData.split("\n").filter(Boolean).map((r) => r.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:ZZ${rows.length}?valueInputOption=RAW`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ range: `A1:${String.fromCharCode(64 + Math.max(...rows.map((r) => r.length)))}${rows.length}`, majorDimension: "ROWS", values: rows }),
      });
    }

    return { success: true, id: sheetId, url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function checkGoogleApiStatus(): Promise<{ configured: boolean; email?: string }> {
  const creds = getCredentials();
  if (!creds) return { configured: false };
  const token = await getAccessToken(GOOGLE_SCOPES.drive);
  return { configured: token !== null, email: creds.client_email };
}
