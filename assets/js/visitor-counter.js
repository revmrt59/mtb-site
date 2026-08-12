(async function () {
  const todayEl = document.getElementById("visitors-today");
  const totalEl = document.getElementById("visitors-total");

  if (!todayEl || !totalEl) return;

  try {
    let visitorId = localStorage.getItem("mtbVisitorId");

    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("mtbVisitorId", visitorId);
    }

    const response = await fetch("/.netlify/functions/visitor-count", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        visitorId: visitorId
      })
    });

    if (!response.ok) {
      throw new Error("Visitor counter request failed.");
    }

    const data = await response.json();

    todayEl.textContent = Number(data.today).toLocaleString();
    totalEl.textContent = Number(data.total).toLocaleString();

  } catch (error) {
    console.error("Visitor counter error:", error);

    const stats = document.querySelector(".visitor-stats");
    if (stats) stats.style.display = "none";
  }
})();