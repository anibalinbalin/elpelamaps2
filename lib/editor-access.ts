export const EDITOR_PIN = "0020";
export const EDITOR_ACCESS_STORAGE_KEY = "parcelpin-editor-access";

export function hasEditorAccess() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(EDITOR_ACCESS_STORAGE_KEY) === "granted";
}

export function grantEditorAccess() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(EDITOR_ACCESS_STORAGE_KEY, "granted");
}
