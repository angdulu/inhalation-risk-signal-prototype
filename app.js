const patterns = [
  {
    id: "p1",
    name: "Membrane-Disrupting Cationic Agents",
    weight: 3,
    rationale:
      "Cationic actives can interact with lipid membranes in the airways, suggesting elevated inhalation signal even at low doses.",
  },
  {
    id: "p2",
    name: "Persistent Polymeric Compounds",
    weight: 3,
    rationale:
      "Polymeric or high-molecular-weight materials can persist on surfaces and become airborne as fine droplets or dust.",
  },
  {
    id: "p3",
    name: "Volatile Organic Compounds (VOCs)",
    weight: 2,
    rationale:
      "Volatile solvents and fragrances can form an inhalable vapor cloud and irritate the upper airway.",
  },
  {
    id: "p4",
    name: "Secondary Pollutant Formation",
    weight: 3,
    rationale:
      "Terpenes and similar compounds can react with indoor ozone to generate secondary pollutants such as ultrafine particles.",
  },
  {
    id: "p5",
    name: "Strong Irritant / Inflammatory Response",
    weight: 2,
    rationale:
      "Irritants can inflame respiratory tissue, heightening sensitivity to repeated exposures.",
  },
  {
    id: "p6",
    name: "Surfactant-Induced Barrier Disruption",
    weight: 2,
    rationale:
      "Surfactants can disrupt mucosal barriers, increasing uptake of other co-formulated substances.",
  },
  {
    id: "p7",
    name: "Aerosolized Exposure Amplification",
    weight: 1,
    rationale:
      "Sprays and aerosols produce fine droplets that travel deeper into the respiratory tract.",
  },
  {
    id: "p8",
    name: "Chronic Low-Dose Repeated Exposure",
    weight: 1,
    rationale:
      "Frequent use can keep airborne concentrations elevated, even if single doses are low.",
  },
  {
    id: "p9",
    name: "Insufficient Inhalation Data",
    weight: 0,
    rationale:
      "Published inhalation-focused data not located. Uncertainty remains high.",
  },
];

const ingredientLibrary = {
  "benzalkonium chloride": {
    display: "Benzalkonium chloride",
    patterns: ["p1", "p6"],
    notes: "Quaternary ammonium surfactant; membrane-active with mucosal interactions.",
    confidence: "Moderate",
    sources: [
      {
        title: "EPA Reregistration Eligibility Decision for Alkyl Dimethyl Benzyl Ammonium Chloride (2006)",
        url: "https://www.epa.gov/sites/default/files/2015-09/documents/benzalkonium-chloride-red.pdf",
      },
    ],
  },
  limonene: {
    display: "Limonene",
    patterns: ["p3", "p4"],
    notes: "Volatile terpene fragrance; reacts with indoor ozone to form secondary aerosols.",
    confidence: "Moderate",
    sources: [
      {
        title: "Weschler & Shields, Indoor ozone/terpene reactions (Environ Sci Technol, 1999)",
        url: "https://doi.org/10.1021/es980947y",
      },
    ],
  },
  "isopropyl alcohol": {
    display: "Isopropyl alcohol",
    patterns: ["p3", "p5"],
    notes: "Volatile solvent; transient upper-airway irritant at higher vapor levels.",
    confidence: "Moderate",
    sources: [
      {
        title: "NIOSH Pocket Guide to Chemical Hazards: Isopropyl alcohol",
        url: "https://www.cdc.gov/niosh/npg/npgd0359.html",
      },
    ],
  },
  "polyquaternium-10": {
    display: "Polyquaternium-10",
    patterns: ["p2"],
    notes: "Cationic polymer; can persist on surfaces and be re-aerosolized.",
    confidence: "Low",
    sources: [
      {
        title: "Manufacturer safety data sheet for Polyquaternium-10 (film-forming polymer)",
        url: "https://www.tcichemicals.com/US/en/p/P1232",
      },
    ],
  },
  "polysorbate 20": {
    display: "Polysorbate 20",
    patterns: ["p6"],
    notes: "Nonionic surfactant that can loosen epithelial barriers, especially in aerosols.",
    confidence: "Low",
    sources: [
      {
        title: "ECHA substance information: Polysorbate 20",
        url: "https://echa.europa.eu/substance-information/-/substanceinfo/100.066.969",
      },
    ],
  },
};

const severityLabels = [
  { min: 0, max: 2, label: "🟢 Low inhalation concern", chip: "Low" },
  { min: 3, max: 5, label: "🟡 Moderate inhalation concern", chip: "Moderate" },
  { min: 6, max: Infinity, label: "🔴 High inhalation concern", chip: "High" },
];

function parseIngredients(raw) {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function lookupIngredient(name) {
  const key = name.toLowerCase();
  return ingredientLibrary[key] || null;
}

function deriveConfidence(entries) {
  const ladder = ["High", "Moderate", "Low", "Insufficient"];
  if (entries.some((c) => c === "Insufficient")) return "Insufficient";
  if (entries.some((c) => c === "Low")) return "Low";
  if (entries.some((c) => c === "Moderate")) return "Moderate";
  if (entries.some((c) => c === "High")) return "High";
  return "Insufficient";
}

function computeScore(patternIds, modifiers) {
  const base = patternIds.reduce((sum, id) => {
    const pattern = patterns.find((p) => p.id === id);
    return sum + (pattern ? pattern.weight : 0);
  }, 0);

  const exposureBonus = Math.max(
    0,
    modifiers.spray + modifiers.indoor + modifiers.frequency - modifiers.ventilation
  );

  return { base, exposureBonus, total: base + exposureBonus };
}

function evaluateSeverity(total) {
  return severityLabels.find((entry) => total >= entry.min && total <= entry.max) || severityLabels[0];
}

function unique(array) {
  return Array.from(new Set(array));
}

function collectReasons(patternIds, ingredientHits, modifiers) {
  const reasons = [];
  const patternCounts = {};

  patternIds.forEach((id) => {
    const pattern = patterns.find((p) => p.id === id);
    if (!pattern) return;
    const related = ingredientHits
      .filter((hit) => hit.patterns.includes(id))
      .map((hit) => hit.display)
      .join(", ");
    const who = related ? ` (${related})` : "";
    reasons.push(`${pattern.name}${who}`);
    patternCounts[id] = (patternCounts[id] || 0) + (pattern.weight || 0);
  });

  if (modifiers.spray > 0) reasons.push("Spray/aerosol use amplifies inhalable droplets");
  if (modifiers.indoor > 0) reasons.push("Indoor use increases residence time of vapors");
  if (modifiers.frequency > 0) reasons.push("Frequent use can keep airborne levels elevated");
  if (modifiers.ventilation > 0) reasons.push("Claimed ventilation reduces accumulation (partial offset)");

  return reasons.slice(0, 3);
}

function describeWhatWeKnow(ingredientHits, patternIds) {
  if (patternIds.length === 0) {
    return ["No identified inhalation risk pattern found. This does not confirm safety. It reflects current knowledge coverage."];
  }

  const statements = ingredientHits.map((hit) => {
    const names = hit.patterns
      .map((id) => patterns.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join("; ");
    return `${hit.display}: ${names} — ${hit.notes}`;
  });

  return statements;
}

function describeWhatWeDontKnow(unknowns, hasInsufficientFlag) {
  const messages = [];
  if (unknowns.length > 0) {
    messages.push(
      `No inhalation-focused data located for: ${unknowns.join(", ")}. Pattern tagged as "Insufficient Inhalation Data."`
    );
  }
  if (hasInsufficientFlag && unknowns.length === 0) {
    messages.push("Several ingredients lack inhalation-specific studies; interpret signals cautiously.");
  }
  if (messages.length === 0) {
    messages.push("Gaps remain in long-term inhalation studies and mixture interactions.");
  }
  return messages;
}

function buildPatternCards(patternIds) {
  const container = document.getElementById("patterns");
  container.innerHTML = "";
  patternIds.forEach((id) => {
    const pattern = patterns.find((p) => p.id === id);
    if (!pattern) return;
    const card = document.createElement("div");
    card.className = "pattern-card";
    card.innerHTML = `
      <div class="pattern-meta">
        <span>${pattern.name}</span>
        <span>Weight: ${pattern.weight}</span>
      </div>
      <p class="muted">${pattern.rationale}</p>
    `;
    container.appendChild(card);
  });
}

function renderSources(ingredientHits) {
  const list = document.getElementById("sources");
  list.innerHTML = "";
  const items = ingredientHits.flatMap((hit) => hit.sources || []);
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No verifiable sources available for the provided ingredients.";
    list.appendChild(li);
    return;
  }

  items.forEach((source) => {
    const li = document.createElement("li");
    if (source.url) {
      li.innerHTML = `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.title}</a>`;
    } else {
      li.textContent = source.title;
    }
    list.appendChild(li);
  });
}

function updateUI({
  severity,
  totalScore,
  base,
  exposureBonus,
  reasons,
  confidence,
  confidenceNotes,
  whatWeKnow,
  whatWeDontKnow,
  patternIds,
  ingredientHits,
}) {
  document.getElementById("signal-label").textContent = `${severity.label} (score ${totalScore})`;
  document.getElementById("signal-chip").textContent = `${severity.chip}`;

  const reasonsList = document.getElementById("key-reasons");
  reasonsList.innerHTML = "";
  if (reasons.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No identified inhalation risk pattern found.";
    reasonsList.appendChild(li);
  } else {
    reasons.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      reasonsList.appendChild(li);
    });
  }

  document.getElementById("confidence").textContent = confidence;
  document.getElementById("confidence-notes").textContent = confidenceNotes || "";

  const whatKnow = document.getElementById("what-we-know");
  whatKnow.innerHTML = "";
  whatWeKnow.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    whatKnow.appendChild(li);
  });

  const whatDontKnow = document.getElementById("what-we-dont-know");
  whatDontKnow.innerHTML = "";
  whatWeDontKnow.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    whatDontKnow.appendChild(li);
  });

  buildPatternCards(patternIds);
  renderSources(ingredientHits);

  const whyMatters = document.getElementById("why-matters");
  const scoreBreakdown = `Base patterns: ${base}, Exposure modifiers: ${exposureBonus}.`;
  if (patternIds.length === 0) {
    whyMatters.textContent = `${scoreBreakdown} No mechanism-based inhalation signals matched. Coverage gaps remain.`;
  } else {
    whyMatters.textContent = `${scoreBreakdown} Signals emphasize mechanism-driven exposure rather than ingredient lists, highlighting how droplets, vapors, and frequency shape inhalation dose.`;
  }
}

function handleForm(event) {
  event.preventDefault();

  const ingredients = parseIngredients(document.getElementById("ingredients-input").value);
  const productForm = document.getElementById("product-form").value;
  const useSetting = document.getElementById("use-setting").value;
  const frequency = document.getElementById("frequency").value;
  const ventilated = document.getElementById("ventilated").checked;

  const ingredientHits = [];
  const unknowns = [];
  const patternBucket = [];
  const confidences = [];

  ingredients.forEach((ingredient) => {
    const hit = lookupIngredient(ingredient);
    if (hit) {
      ingredientHits.push(hit);
      patternBucket.push(...hit.patterns);
      confidences.push(hit.confidence || "Moderate");
    } else {
      unknowns.push(ingredient);
      patternBucket.push("p9");
      confidences.push("Insufficient");
    }
  });

  if (productForm === "spray") {
    patternBucket.push("p7");
  }
  if (frequency === "daily") {
    patternBucket.push("p8");
  }

  const patternIds = unique(patternBucket);
  const modifiers = {
    spray: productForm === "spray" ? 1 : 0,
    indoor: useSetting === "indoor" ? 1 : 0,
    frequency: frequency === "daily" ? 1 : 0,
    ventilation: ventilated ? 1 : 0,
  };

  const { base, exposureBonus, total } = computeScore(patternIds.filter((id) => id !== "p9"), modifiers);
  const severity = evaluateSeverity(total);
  const reasons = collectReasons(patternIds.filter((id) => id !== "p9"), ingredientHits, modifiers);
  const hasInsufficientFlag = patternIds.includes("p9");

  const whatWeKnow = describeWhatWeKnow(ingredientHits, patternIds.filter((id) => id !== "p9"));
  const whatWeDontKnow = describeWhatWeDontKnow(unknowns, hasInsufficientFlag);

  const confidence = deriveConfidence(confidences);
  const confidenceNotes = confidence === "High"
    ? "Based on peer-reviewed inhalation or strong mechanistic studies."
    : confidence === "Moderate"
      ? "Mechanistic or limited inhalation data available."
      : confidence === "Low"
        ? "Reliance on regulatory classifications or indirect evidence; uncertainty is elevated."
        : "No long-term inhalation studies found; interpret signals with caution.";

  updateUI({
    severity,
    totalScore: total,
    base,
    exposureBonus,
    reasons,
    confidence,
    confidenceNotes,
    whatWeKnow,
    whatWeDontKnow,
    patternIds: patternIds.filter((id) => id !== "p9"),
    ingredientHits,
  });
}

function resetForm() {
  document.getElementById("irs-form").reset();
  document.getElementById("ingredients-input").value = "";
  updateUI({
    severity: severityLabels[0],
    totalScore: 0,
    base: 0,
    exposureBonus: 0,
    reasons: [],
    confidence: "Insufficient",
    confidenceNotes: "Provide ingredients to calculate an inhalation signal.",
    whatWeKnow: ["Awaiting input."],
    whatWeDontKnow: ["No ingredients provided; inhalation coverage unknown."],
    patternIds: [],
    ingredientHits: [],
  });
}

document.getElementById("irs-form").addEventListener("submit", handleForm);
document.getElementById("reset-btn").addEventListener("click", resetForm);

resetForm();
