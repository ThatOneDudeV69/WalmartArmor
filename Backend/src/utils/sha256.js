export async function sha256(input) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}
