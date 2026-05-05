export function setStatus(message) {
  const node = document.getElementById("status-text");
  if (node) node.textContent = message;
}
