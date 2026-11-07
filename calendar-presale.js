const $ = (selector) => document.querySelector(selector);
let csrf = "";
async function api(path, options = {}) {
  const response = await fetch("/api/family" + path, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...options.headers } });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !type.includes("application/json")) throw Error(response.status === 403 ? "closed" : "network");
  return response.json();
}
const disable = (form, value) => { for (const item of form.elements) item.disabled = value; };
async function init() {
  try { const session = await api("/session"); csrf = session.csrf || ""; if (session.authenticated) $("#import").hidden = false; } catch {}
  const config = await api("/presale/config");
  if (!config.open) { $("#sale-status").textContent = "Sắp mở — chưa nhận đơn và chưa thu tiền."; return; }
  $("#sale-status").textContent = `Nhận đặt trước đến ${config.deadline}.`;
  $("#sale-details").hidden = false;
  $("#sale-details").textContent = `Bản cơ bản: ${config.price} · Bản gia đình: ${config.familyPrice || config.price} · Chuyển khoản ${config.bank}, ${config.accountName}, ${config.account}. Nội dung: ${config.reference}.`;
  $("#order").hidden = false;
}
$("#import").onclick = async () => { try { const data = await api("/tablets"); $("#order").anniversaries.value = data.tablets.slice(0, 10).map((item) => `${item.honorific} ${item.full_name} | ${item.death_lunar_day}/${item.death_lunar_month} âm lịch`).join("\n"); } catch { $("#order-result").textContent = "Chưa thể đọc bài vị."; } };
$("#order").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget, lines = form.anniversaries.value.split(/\r?\n/).map((line) => line.split("|").map((part) => part.trim())).filter((parts) => parts.length === 2 && parts[0] && parts[1]).slice(0, 10); disable(form, true); try { const data = await api("/presale/orders", { method: "POST", body: JSON.stringify({ edition: form.edition.value, familyName: form.familyName.value, contact: form.contact.value, anniversaries: lines.map(([name, date]) => ({ name, date })), address: form.address.value, agree: form.agree.checked }) }); $("#order-result").textContent = `Đã ghi nhận đơn ${data.order.id.slice(0, 8)}. Nội dung chuyển khoản: ${data.reference}.`; } catch { $("#order-result").textContent = "Mạng không ổn định, vui lòng thử lại."; disable(form, false); } };
$("#interest").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; disable(form, true); try { await api("/presale/interests", { method: "POST", body: JSON.stringify({ name: form.name.value, contact: form.contact.value, ancestorCount: form.ancestorCount.value, willingness: form.willingness.value, region: form.region.value, agree: form.agree.checked }) }); $("#interest-result").textContent = "Cảm ơn! Chúng tôi đã ghi nhận."; form.reset(); } catch { $("#interest-result").textContent = "Mạng không ổn định, vui lòng thử lại."; disable(form, false); } };
init().catch(() => { $("#sale-status").textContent = "Sắp mở — chưa nhận đơn và chưa thu tiền."; });
