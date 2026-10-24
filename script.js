
 // =====================================================
 // SKILLBRIDGE - COMPLETE MAIN JAVASCRIPT
 // Domain Selection + Skills + Assessment + Progress
 // + Project Recommendations
 // =====================================================

 // =====================================================
 // 1. COMMON NAVBAR / PAGE ACCESS
 // =====================================================

 const projectLink = document.getElementById("projectLink");

 if (projectLink) {
     projectLink.addEventListener("click", function (event) {
         if (localStorage.getItem("assessmentCompleted") !== "true") {
             event.preventDefault();
             alert(
                 "Please complete the Self-Assessment before opening Project Recommendation."
             );
         }
     });
 }

 // =====================================================
 // 2. API CONFIGURATION AND SHARED HELPERS
 // =====================================================

 const API_BASE = (
     window.SKILLBRIDGE_API ||
     (
         window.location.protocol === "file:" ||
         /:(5500|5501|3000)$/.test(window.location.host)
             ? "http://127.0.0.1:5000"
             : window.location.origin
     )
 ).replace(/\/$/, "");

 let availableDomains = [];
 let domainSkillsCache = {};

 // Safely read JSON data from localStorage.
 function getStoredJSON(key, fallback = null) {
     try {
         const value = localStorage.getItem(key);
         return value ? JSON.parse(value) : fallback;
     } catch (error) {
         console.error("Could not read saved data:", error);
         return fallback;
     }
 }

 // Normalize domain names before comparing them.
 function normalizeDomainName(value) {
     return String(value || "")
         .trim()
         .toLowerCase()
         .replace(/\s+/g, " ");
 }

 // Normalize skill difficulty levels.
 function normalizeLevel(value) {
     const level = String(value || "").trim().toLowerCase();

     if (level === "basic" || level === "beginner") {
         return "basic";
     }

     if (level === "intermediate" || level === "medium") {
         return "intermediate";
     }

     if (level === "advanced" || level === "expert") {
         return "advanced";
     }

     return level || "basic";
 }

 // Escape dynamic text before inserting it into HTML.
 function escapeHTML(value) {
     return String(value ?? "").replace(/[&<>"']/g, character => {
         const entities = {
             "&": "&amp;",
             "<": "&lt;",
             ">": "&gt;",
             '"': "&quot;",
             "'": "&#39;"
         };

         return entities[character];
     });
 }

 // Fetch JSON from the Flask backend and report API errors.
 async function apiJSON(url, options = {}) {
     const response = await fetch(url, options);

     let data;

     try {
         data = await response.json();
     } catch (error) {
         throw new Error(
             `Server returned an invalid response (HTTP ${response.status}).`
         );
     }

     if (!response.ok || data.success === false) {
         throw new Error(
             data.message ||
             data.error ||
             `Request failed (HTTP ${response.status}).`
         );
     }

     return data;
 }

 // Find a database domain by its name.
 function findDatabaseDomain(domainName) {
     const normalizedName = normalizeDomainName(domainName);

     if (!normalizedName) {
         return null;
     }

     return availableDomains.find(domain =>
         normalizeDomainName(domain.domain_name) === normalizedName
     ) || null;
 }

 // =====================================================
 // SECTION 3 STARTS BELOW
 // Keep your existing section 3 and all following code.
 // =====================================================



// =====================================================
// 3. DOMAIN PAGE - FIXED DOMAIN SELECTION
// =====================================================

const domainCards = document.querySelectorAll(".domain-card");
const selectedDomainText = document.getElementById("selectedDomainText");
const continueSkillsBtn = document.getElementById("continueSkillsBtn");

let selectedDomain = localStorage.getItem("selectedDomain") || "";
let domainsLoaded = false;

function clearDomainSelection() {
    selectedDomain = "";
    localStorage.removeItem("selectedDomain");

    domainCards.forEach(card => {
        card.classList.remove("selected");
    });

    if (selectedDomainText) {
        selectedDomainText.textContent = "Select a domain";
    }

    if (continueSkillsBtn) {
        continueSkillsBtn.disabled = true;
    }
}

function selectDomain(card) {
    const domainName = String(card.dataset.domain || "").trim();

    if (!domainName) {
        alert("This domain card does not have a domain name.");
        return;
    }

    if (domainsLoaded && !findDatabaseDomain(domainName)) {
        alert(
            "This domain was not found in the database. " +
            "Please check the domain name in career_domains."
        );
        return;
    }

    selectedDomain = domainName;
    localStorage.setItem("selectedDomain", domainName);

    domainCards.forEach(item => {
        item.classList.toggle("selected", item === card);
    });

    if (selectedDomainText) {
        selectedDomainText.textContent = domainName;
    }

    if (continueSkillsBtn) {
        continueSkillsBtn.disabled =
            !domainsLoaded || !findDatabaseDomain(domainName);
    }
}

// Attach listeners immediately, before the API request.
domainCards.forEach(card => {
    const button = card.querySelector(".domain-select-btn");

    if (button) {
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            selectDomain(card);
        });
    }

    card.addEventListener("click", function (event) {
        if (event.target.closest("button, a, input, select, textarea")) {
            return;
        }

        selectDomain(card);
    });

    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");

    card.addEventListener("keydown", function (event) {
        if (
            event.target === card &&
            (event.key === "Enter" || event.key === " ")
        ) {
            event.preventDefault();
            selectDomain(card);
        }
    });
});

async function loadDomains() {
    if (!domainCards.length) return;

    if (continueSkillsBtn) {
        continueSkillsBtn.disabled = true;
    }

    try {
        const data = await apiJSON(`${API_BASE}/api/domains`);

        availableDomains = Array.isArray(data.domains)
            ? data.domains
            : [];

        if (!availableDomains.length) {
            throw new Error("No career domains were returned by the server.");
        }

        domainsLoaded = true;

        domainCards.forEach(card => {
            const cardName = String(card.dataset.domain || "").trim();
            const exists = Boolean(findDatabaseDomain(cardName));
            const button = card.querySelector(".domain-select-btn");

            card.classList.toggle("unavailable-domain", !exists);
            card.setAttribute("aria-disabled", String(!exists));

            if (button) {
                button.disabled = !exists;
            }

            if (!exists) {
                console.warn("Domain not found in database:", cardName);
            }
        });

        const savedDomain = findDatabaseDomain(selectedDomain);

        if (savedDomain) {
            const matchingCard = Array.from(domainCards).find(
                card =>
                    normalizeDomainName(card.dataset.domain) ===
                    normalizeDomainName(savedDomain.domain_name)
            );

            if (matchingCard) {
                selectedDomain = savedDomain.domain_name;
                localStorage.setItem("selectedDomain", selectedDomain);

                domainCards.forEach(card => {
                    card.classList.toggle("selected", card === matchingCard);
                });

                if (selectedDomainText) {
                    selectedDomainText.textContent = selectedDomain;
                }

                if (continueSkillsBtn) {
                    continueSkillsBtn.disabled = false;
                }
            } else {
                clearDomainSelection();
            }
        } else {
            clearDomainSelection();
        }

    } catch (error) {
        console.error("Could not load domains:", error);

        if (selectedDomainText) {
            selectedDomainText.textContent = "Could not load domains";
        }

        if (continueSkillsBtn) {
            continueSkillsBtn.disabled = true;
        }

        alert(
            "Unable to load career domains. Make sure Flask is running " +
            "and /api/domains works.\n\nDetails: " + error.message
        );
    }
}

if (continueSkillsBtn) {
    continueSkillsBtn.disabled = true;

    continueSkillsBtn.addEventListener("click", function () {
        const matchedDomain = findDatabaseDomain(
            localStorage.getItem("selectedDomain") || ""
        );

        if (!domainsLoaded || !matchedDomain) {
            alert("Please select a valid career domain first.");
            return;
        }

        localStorage.setItem("selectedDomain", matchedDomain.domain_name);
        window.location.href = "skills.html";
    });
}

loadDomains();


// =====================================================
// 4. SKILLS PAGE - LOAD SKILLS FROM DATABASE
// =====================================================

const basicSkills = document.getElementById("basicSkills");
const intermediateSkills = document.getElementById("intermediateSkills");
const advancedSkills = document.getElementById("advancedSkills");
const currentDomainElement = document.getElementById("currentDomain");
const selectedSkillsCount = document.getElementById("selectedSkillsCount");
const continueAssessmentBtn = document.getElementById("continueAssessmentBtn");

function getDomainSkillKey(domain) {
    return "selectedSkills_" + domain;
}

function createSkillCard(skill) {
    const level = normalizeLevel(skill.difficulty_level);
    const displayLevel = level.charAt(0).toUpperCase() + level.slice(1);

    return `
        <label class="skill-card">
            <input
                type="checkbox"
                class="skill-checkbox"
                value="${escapeHTML(skill.skill_name)}"
                data-skill-id="${escapeHTML(skill.skill_id)}"
                data-level="${level}"
            >

            <span class="custom-checkbox"></span>

            <div class="skill-content">
                <h3>${escapeHTML(skill.skill_name)}</h3>

                <p>
                    ${escapeHTML(
                        skill.description ||
                        "Build practical knowledge in this skill."
                    )}
                </p>

                <small class="skill-level">
                    ${escapeHTML(displayLevel)} level
                </small>

                ${
                    skill.priority
                        ? `<small class="skill-priority">
                            Priority: ${escapeHTML(skill.priority)}
                           </small>`
                        : ""
                }
            </div>
        </label>
    `;
}

function displaySkillGroup(container, skills) {
    if (container) {
        container.innerHTML = skills.map(createSkillCard).join("");
    }
}

function setupSkillSelection(domain, allSkills) {
    const storageKey = getDomainSkillKey(domain);
    let selectedSkills = getStoredJSON(storageKey, []);

    if (!Array.isArray(selectedSkills)) {
        selectedSkills = [];
    }

    const checkboxes = document.querySelectorAll(".skill-checkbox");

    function updateSkillCount() {
        if (selectedSkillsCount) {
            selectedSkillsCount.textContent =
                `${selectedSkills.length} ` +
                `${selectedSkills.length === 1 ? "Skill" : "Skills"} Selected`;
        }

        if (continueAssessmentBtn) {
            continueAssessmentBtn.disabled = selectedSkills.length === 0;
        }
    }

    function saveSelectedSkillDetails() {
        const details = allSkills
            .filter(skill => selectedSkills.includes(skill.skill_name))
            .map(skill => ({
                skill_id: skill.skill_id,
                skill_name: skill.skill_name,
                difficulty_level: skill.difficulty_level,
                priority: skill.priority || "Medium"
            }));

        localStorage.setItem("selectedSkillDetails", JSON.stringify(details));
    }

    checkboxes.forEach(checkbox => {
        const card = checkbox.closest(".skill-card");

        checkbox.checked = selectedSkills.includes(checkbox.value);

        if (card) {
            card.classList.toggle("selected", checkbox.checked);
        }

        checkbox.addEventListener("change", function () {
            if (checkbox.checked) {
                if (!selectedSkills.includes(checkbox.value)) {
                    selectedSkills.push(checkbox.value);
                }
            } else {
                selectedSkills = selectedSkills.filter(
                    name => name !== checkbox.value
                );
            }

            if (card) {
                card.classList.toggle("selected", checkbox.checked);
            }

            localStorage.setItem(storageKey, JSON.stringify(selectedSkills));
            localStorage.setItem("selectedSkills", JSON.stringify(selectedSkills));

            saveSelectedSkillDetails();
            updateSkillCount();
        });
    });

    updateSkillCount();
}

async function displaySkills() {
    const domain = localStorage.getItem("selectedDomain") || "";

    [basicSkills, intermediateSkills, advancedSkills].forEach(container => {
        if (container) container.innerHTML = "";
    });

    if (currentDomainElement) {
        currentDomainElement.textContent = domain || "No domain selected";
    }

    if (selectedSkillsCount) {
        selectedSkillsCount.textContent = "0 Skills Selected";
    }

    if (continueAssessmentBtn) {
        continueAssessmentBtn.disabled = true;
    }

    if (!domain) {
        if (currentDomainElement) {
            currentDomainElement.textContent = "Please select a domain first";
        }
        return;
    }

    try {
        const domainsData = await apiJSON(`${API_BASE}/api/domains`);
        const domains = Array.isArray(domainsData.domains)
            ? domainsData.domains
            : [];

        const matchingDomain = domains.find(
            item =>
                normalizeDomainName(item.domain_name) ===
                normalizeDomainName(domain)
        );

        if (!matchingDomain) {
            if (currentDomainElement) {
                currentDomainElement.textContent =
                    "Domain not found in database";
            }
            return;
        }

        const data = await apiJSON(
            `${API_BASE}/api/domains/${matchingDomain.domain_id}/skills`
        );

        const skills = Array.isArray(data.skills) ? data.skills : [];
        domainSkillsCache[matchingDomain.domain_name] = skills;

        const grouped = {
            basic: [],
            intermediate: [],
            advanced: []
        };

        skills.forEach(skill => {
            grouped[normalizeLevel(skill.difficulty_level)].push(skill);
        });

        displaySkillGroup(basicSkills, grouped.basic);
        displaySkillGroup(intermediateSkills, grouped.intermediate);
        displaySkillGroup(advancedSkills, grouped.advanced);

        setupSkillSelection(matchingDomain.domain_name, skills);

    } catch (error) {
        console.error("Could not load skills:", error);

        if (currentDomainElement) {
            currentDomainElement.textContent =
                "Could not load skills from database";
        }

        alert(
            "Unable to load skills. Make sure Flask is running.\n\nDetails: " +
            error.message
        );
    }
}

if (basicSkills && intermediateSkills && advancedSkills) {
    displaySkills();
}

if (continueAssessmentBtn) {
    continueAssessmentBtn.addEventListener("click", function () {
        const domain = localStorage.getItem("selectedDomain") || "";
        const selected = getStoredJSON(getDomainSkillKey(domain), []);

        if (!domain) {
            alert("Please select a career domain first.");
            return;
        }

        if (!Array.isArray(selected) || selected.length === 0) {
            alert("Please select at least one skill.");
            return;
        }

        localStorage.setItem("selectedSkills", JSON.stringify(selected));

        const allSkills = domainSkillsCache[domain] || [];

        const details = allSkills
            .filter(skill => selected.includes(skill.skill_name))
            .map(skill => ({
                skill_id: skill.skill_id,
                skill_name: skill.skill_name,
                difficulty_level: skill.difficulty_level,
                priority: skill.priority || "Medium"
            }));

        localStorage.setItem("selectedSkillDetails", JSON.stringify(details));

        // Clear old results when beginning a new assessment.
        [
            "assessmentAnswers",
            "skillResults",
            "assessmentScore",
            "assessmentCompleted",
            "skillBridgeDbAnswers"
        ].forEach(key => localStorage.removeItem(key));

        window.location.href = "assessment.html";
    });
}


 // =====================================================
 // 5. DATABASE-DRIVEN SELF-ASSESSMENT
 // Mixed difficulty + duplicate protection + up to 20
 // questions per skill
 // =====================================================

 (function () {
     const questionText = document.getElementById("questionText");
     if (!questionText) return;

     const $ = id => document.getElementById(id);
     const API = API_BASE;

     const domainEl = $("assessmentDomain");
     const currentSkillEl = $("currentSkill");
     const totalEl = $("totalQuestions");
     const completedEl = $("completedQuestions");
     const tabsEl = $("skillTabs");
     const numberEl = $("questionNumber");
     const percentageEl = $("quizPercentage");
     const progressFill = $("quizProgressFill");
     const typeEl = $("questionType");
     const categoryEl = $("questionCategory");
     const optionsEl = $("optionsContainer");
     const previousBtn = $("previousQuestionBtn");
     const nextBtn = $("nextQuestionBtn");

     const domain = localStorage.getItem("selectedDomain") || "";
     let selectedSkills = getStoredJSON("selectedSkills", []);
     let questions = [];
     let currentIndex = 0;
     let answers = getStoredJSON("skillBridgeDbAnswers", {});
     let completed = false;
     let submitting = false;

     if (!Array.isArray(selectedSkills)) selectedSkills = [];

     if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
         answers = {};
     }

     if (domainEl) domainEl.textContent = domain || "Not selected";

     function showMessage(message) {
         questionText.textContent = message;
         if (optionsEl) optionsEl.innerHTML = "";
         if (previousBtn) previousBtn.disabled = true;
         if (nextBtn) nextBtn.disabled = true;
         if (totalEl) totalEl.textContent = questions.length;
     }

     function getSelectedSkillLevel(skill) {
         const savedLevels = getStoredJSON("selectedSkillLevels", {});
         const saved = savedLevels[skill.skill_name];

         const raw = saved || skill.difficulty_level || "Intermediate";
         const level = String(raw).trim().toLowerCase();

         if (level === "beginner" || level === "basic") return "Basic";
         if (level === "medium" || level === "intermediate") return "Intermediate";
         if (level === "expert" || level === "advanced") return "Advanced";

         return "Intermediate";
     }

     function normalizeQuestion(question, skill) {
         return {
             ...question,
             question_id: question.question_id,
             skill_id: skill.skill_id,
             skill_name: skill.skill_name,
             difficulty_level: question.difficulty_level || "Basic"
         };
     }

     // Fetch all available difficulty levels for one skill.
     // Prioritize the skill's selected level, then fill from other levels.
     async function loadQuestionsForSkill(skill) {
         const preferred = getSelectedSkillLevel(skill);
         const levels = [
             preferred,
             ...["Basic", "Intermediate", "Advanced"].filter(
                 level => level !== preferred
             )
         ];

         const collected = [];
         const seenIds = new Set();
         const targetCount = 20;

         for (const level of levels) {
             if (collected.length >= targetCount) break;

             const url =
                 `${API}/api/questions` +
                 `?skill_id=${encodeURIComponent(skill.skill_id)}` +
                 `&difficulty=${encodeURIComponent(level)}`;

             try {
                 const data = await apiJSON(url);
                 const batch = Array.isArray(data.questions)
                     ? data.questions
                     : [];

                 for (const item of batch) {
                     const id = String(item.question_id ?? "");

                     if (!id || seenIds.has(id)) continue;

                     seenIds.add(id);
                     collected.push(normalizeQuestion(item, skill));

                     if (collected.length >= targetCount) break;
                 }
             } catch (error) {
                 console.warn(
                     `Could not load ${level} questions for ${skill.skill_name}:`,
                     error.message
                 );
             }
         }

         return collected;
     }

     function updateTabs() {
         if (!tabsEl) return;
         tabsEl.innerHTML = "";

         const uniqueSkills = [
             ...new Set(questions.map(question => question.skill_name))
         ];

         uniqueSkills.forEach(skillName => {
             const button = document.createElement("button");
             button.type = "button";
             button.className = "skill-tab";
             button.textContent = skillName;

             button.addEventListener("click", function () {
                 const index = questions.findIndex(
                     question => question.skill_name === skillName
                 );

                 if (index !== -1 && !completed && !submitting) {
                     currentIndex = index;
                     renderQuestion();
                 }
             });

             tabsEl.appendChild(button);
         });
     }

     function renderQuestion() {
         if (completed) return;

         const question = questions[currentIndex];

         if (!question) {
             showMessage("No questions are available for these skills.");
             return;
         }

         if (currentSkillEl) {
             currentSkillEl.textContent = question.skill_name;
         }

         if (numberEl) {
             numberEl.textContent =
                 `Question ${currentIndex + 1} of ${questions.length}`;
         }

         const percentage = Math.round(
             ((currentIndex + 1) / questions.length) * 100
         );

         if (percentageEl) percentageEl.textContent = percentage + "%";
         if (progressFill) progressFill.style.width = percentage + "%";

         if (categoryEl) {
             categoryEl.textContent =
                 `${question.difficulty_level || "Mixed"} Assessment`;
         }

         if (typeEl) typeEl.textContent = "Multiple Choice";
         questionText.textContent = question.question_text || "Question text unavailable.";

         if (optionsEl) optionsEl.innerHTML = "";

         ["A", "B", "C", "D"].forEach(letter => {
             const button = document.createElement("button");
             button.type = "button";
             button.className = "quiz-option";

             const optionText = question["option_" + letter.toLowerCase()];
             button.textContent = `${letter}. ${optionText ?? ""}`;

             if (answers[question.question_id] === letter) {
                 button.classList.add("selected");
             }

             button.addEventListener("click", function () {
                 if (completed || submitting) return;

                 answers[question.question_id] = letter;

                 localStorage.setItem(
                     "skillBridgeDbAnswers",
                     JSON.stringify(answers)
                 );

                 renderQuestion();
             });

             if (optionsEl) optionsEl.appendChild(button);
         });

         if (completedEl) {
             completedEl.textContent = questions.filter(
                 item => Boolean(answers[item.question_id])
             ).length;
         }

         if (previousBtn) {
             previousBtn.disabled = currentIndex === 0 || submitting;
         }

         if (nextBtn) {
             nextBtn.disabled =
                 !answers[question.question_id] || submitting;

             nextBtn.textContent =
                 currentIndex === questions.length - 1
                     ? "Submit Assessment"
                     : "Next →";
         }

         if (tabsEl) {
             tabsEl.querySelectorAll(".skill-tab").forEach(tab => {
                 const skillQuestions = questions.filter(
                     item => item.skill_name === tab.textContent
                 );

                 const allAnswered = skillQuestions.every(
                     item => Boolean(answers[item.question_id])
                 );

                 tab.classList.toggle(
                     "active",
                     tab.textContent === question.skill_name
                 );

                 tab.classList.toggle("completed", allAnswered);
             });
         }
     }

     async function finishAssessment() {
         if (completed || submitting) return;

         const unanswered = questions.filter(
             question => !answers[question.question_id]
         );

         if (unanswered.length) {
             alert(
                 `Please answer all questions. ${unanswered.length} question(s) remain unanswered.`
             );
             return;
         }

         submitting = true;

         if (nextBtn) {
             nextBtn.disabled = true;
             nextBtn.textContent = "Submitting...";
         }

         if (previousBtn) previousBtn.disabled = true;

         try {
             let userId = null;

             try {
                 const currentUser = JSON.parse(
                     sessionStorage.getItem("skillbridgeUser") || "{}"
                 );

                 userId =
                     currentUser.user_id ??
                     currentUser.userId ??
                     currentUser.id ??
                     currentUser.ID ??
                     null;

                 if (userId !== null) {
                     userId = Number(userId);

                     if (!Number.isInteger(userId) || userId <= 0) {
                         userId = null;
                     }
                 }
             } catch (error) {
                 console.warn("Could not read current user:", error);
             }

             const questionsBySkill = new Map();

             questions.forEach(question => {
                 const key = String(question.skill_id);

                 if (!questionsBySkill.has(key)) {
                     questionsBySkill.set(key, []);
                 }

                 questionsBySkill.get(key).push(question);
             });

             const savedResults = [];

             for (const [, skillQuestions] of questionsBySkill) {
                 const skill = skillQuestions[0];

                 const responseData = await apiJSON(
                     `${API}/api/assessment/submit`,
                     {
                         method: "POST",
                         headers: {
                             "Content-Type": "application/json"
                         },
                         body: JSON.stringify({
                             user_id: userId,
                             answers: skillQuestions.map(question => ({
                                 question_id: question.question_id,
                                 answer: answers[question.question_id]
                             }))
                         })
                     }
                 );

                 const result = responseData.result || responseData;

                 const score = Number(
                     result.score ??
                     result.correct_answers ??
                     result.correctAnswers
                 );

                 const total = Number(
                     result.total ??
                     result.total_questions ??
                     result.totalQuestions ??
                     skillQuestions.length
                 );

                 if (
                     !Number.isFinite(score) ||
                     !Number.isFinite(total) ||
                     total <= 0
                 ) {
                     throw new Error(
                         `The server returned an invalid score for ${skill.skill_name}.`
                     );
                 }

                 const levels = [
                     ...new Set(
                         skillQuestions.map(question =>
                             String(question.difficulty_level || "")
                                 .trim()
                                 .toLowerCase()
                         )
                     )
                 ];

                 savedResults.push({
                     success: true,
                     score,
                     total,
                     percentage: Math.round((score / total) * 100),
                     skill_name: skill.skill_name,
                     skill_id: skill.skill_id,
                     difficulty: levels.length > 1
                         ? "Mixed"
                         : skill.difficulty_level
                 });
             }

             const totalScore = savedResults.reduce(
                 (sum, result) => sum + result.score, 0
             );

             const totalQuestions = savedResults.reduce(
                 (sum, result) => sum + result.total, 0
             );

             if (!totalQuestions) {
                 throw new Error("No assessment results were returned.");
             }

             const overallPercentage = Math.round(
                 (totalScore / totalQuestions) * 100
             );

             const finalResult = {
                 success: true,
                 score: totalScore,
                 total: totalQuestions,
                 percentage: overallPercentage,
                 domain,
                 user_id: userId,
                 skillResults: savedResults,
                 completedAt: new Date().toISOString()
             };

             localStorage.setItem(
                 "assessmentScore",
                 String(overallPercentage)
             );

             localStorage.setItem("assessmentCompleted", "true");

             localStorage.setItem(
                 "skillResults",
                 JSON.stringify(finalResult)
             );

             completed = true;
             questionText.textContent = "Assessment Completed!";

             if (optionsEl) {
                 optionsEl.innerHTML = "";

                 const summary = document.createElement("div");
                 summary.className = "assessment-result";

                 const heading = document.createElement("h3");
                 heading.textContent =
                     `Your Score: ${totalScore} / ${totalQuestions}`;

                 const scoreText = document.createElement("p");
                 scoreText.textContent =
                     `Percentage: ${overallPercentage}%`;

                 summary.append(heading, scoreText);

                 savedResults.forEach(result => {
                     const item = document.createElement("p");
                     item.textContent =
                         `${result.skill_name}: ${result.score} / ${result.total}`;
                     summary.appendChild(item);
                 });

                 optionsEl.appendChild(summary);
             }

             if (categoryEl) categoryEl.textContent = "Your Results";
             if (typeEl) typeEl.textContent = "Completed";
             if (numberEl) numberEl.textContent = "Assessment complete";
             if (percentageEl) percentageEl.textContent = "100%";
             if (progressFill) progressFill.style.width = "100%";
             if (completedEl) completedEl.textContent = totalQuestions;
             if (previousBtn) previousBtn.disabled = true;
             if (nextBtn) nextBtn.disabled = true;

             alert(
                 `Assessment submitted successfully! Your overall score is ${overallPercentage}%.`
             );

             window.location.href = "progress.html";

         } catch (error) {
             console.error("Assessment submission failed:", error);
             alert("Could not submit assessment:\n" + error.message);

             submitting = false;

             if (previousBtn) {
                 previousBtn.disabled = currentIndex === 0;
             }

             if (nextBtn) {
                 nextBtn.disabled =
                     !answers[questions[currentIndex]?.question_id];

                 nextBtn.textContent =
                     currentIndex === questions.length - 1
                         ? "Submit Assessment"
                         : "Next →";
             }
         }
     }

     if (previousBtn) {
         previousBtn.addEventListener("click", function () {
             if (currentIndex > 0 && !completed && !submitting) {
                 currentIndex--;
                 renderQuestion();
             }
         });
     }

     if (nextBtn) {
         nextBtn.addEventListener("click", function () {
             if (completed || submitting) return;

             const question = questions[currentIndex];

             if (!question || !answers[question.question_id]) {
                 alert("Please select an answer first.");
                 return;
             }

             if (currentIndex === questions.length - 1) {
                 finishAssessment();
             } else {
                 currentIndex++;
                 renderQuestion();
             }
         });
     }

     async function init() {
         if (previousBtn) previousBtn.disabled = true;
         if (nextBtn) nextBtn.disabled = true;

         if (!domain || selectedSkills.length === 0) {
             showMessage(
                 "Please return to the Skills page and select at least one skill."
             );
             return;
         }

         questionText.textContent = "Loading questions from the database...";

         try {
             const domainData = await apiJSON(`${API}/api/domains`);

             const matchingDomain = (domainData.domains || []).find(
                 item =>
                     normalizeDomainName(item.domain_name) ===
                     normalizeDomainName(domain)
             );

             if (!matchingDomain) {
                 showMessage("This domain was not found in the database.");
                 return;
             }

             const skillsData = await apiJSON(
                 `${API}/api/domains/${matchingDomain.domain_id}/skills`
             );

             const availableSkills = Array.isArray(skillsData.skills)
                 ? skillsData.skills
                 : [];

             const matchedSkills = selectedSkills.map(name =>
                 availableSkills.find(skill => skill.skill_name === name)
             ).filter(Boolean);

             if (!matchedSkills.length) {
                 showMessage(
                     "Your selected skills do not match the database. Please return to the Skills page."
                 );
                 return;
             }

             questions = [];

             // Fetch questions per skill, preserving selected-level priority.
             for (const skill of matchedSkills) {
                 const skillQuestions = await loadQuestionsForSkill(skill);

                 if (!skillQuestions.length) {
                     console.warn(
                         `No questions found for ${skill.skill_name}.`
                     );
                 }

                 questions.push(...skillQuestions);
             }

             // Remove any accidental duplicate IDs across skills too.
             const seenIds = new Set();

             questions = questions.filter(question => {
                 const id = String(question.question_id);

                 if (seenIds.has(id)) return false;

                 seenIds.add(id);
                 return true;
             });

             const validQuestionIds = new Set(
                 questions.map(question => String(question.question_id))
             );

             Object.keys(answers).forEach(id => {
                 if (!validQuestionIds.has(String(id))) {
                     delete answers[id];
                 }
             });

             localStorage.setItem(
                 "skillBridgeDbAnswers",
                 JSON.stringify(answers)
             );

             if (!questions.length) {
                 showMessage(
                     "No questions were found for your selected skills. Check the quiz_questions table and the question API."
                 );
                 return;
             }

             if (totalEl) totalEl.textContent = questions.length;

             updateTabs();
             renderQuestion();

             const shortSkills = matchedSkills.filter(skill =>
                 questions.filter(
                     question => String(question.skill_id) === String(skill.skill_id)
                 ).length < 20
             );

             if (shortSkills.length) {
                 console.info(
                     "Some skills have fewer than 20 questions in the database:",
                     shortSkills.map(skill => skill.skill_name)
                 );
             }

         } catch (error) {
             console.error("Assessment loading failed:", error);

             showMessage(
                 "Unable to load questions. Check that Flask is running and the database APIs are working.\n\nDetails: " +
                 error.message
             );
         }
     }

     init();
 })();



// =====================================================
// 6. PROGRESS REPORT PAGE
// =====================================================

(function () {
    const progressDomain = document.getElementById("progressDomain");

    if (!progressDomain) return;

    const overallPercentageElement = document.getElementById("overallPercentage");
    const correctAnswersElement = document.getElementById("correctAnswers");
    const totalQuestionsElement = document.getElementById("totalQuestions");
    const skillsAssessedElement = document.getElementById("skillsAssessed");
    const skillProgressList = document.getElementById("skillProgressList");
    const circlePercentage = document.getElementById("circlePercentage");
    const overallMessage = document.getElementById("overallMessage");
    const strongSkillsCount = document.getElementById("strongSkillsCount");
    const improvementSkillsCount = document.getElementById("improvementSkillsCount");
    const weakSkillsCount = document.getElementById("weakSkillsCount");
    const preparationCards = document.getElementById("preparationCards");
    const roadmapBtn = document.getElementById("roadmapBtn");

    function readResult() {
        const result = getStoredJSON("skillResults", null);

        return result && typeof result === "object"
            ? result
            : null;
    }

    function showNoResult() {
        progressDomain.textContent =
            localStorage.getItem("selectedDomain") || "Not selected";

        if (overallPercentageElement) overallPercentageElement.textContent = "0%";
        if (circlePercentage) circlePercentage.textContent = "0%";
        if (correctAnswersElement) correctAnswersElement.textContent = "0";
        if (totalQuestionsElement) totalQuestionsElement.textContent = "0";
        if (skillsAssessedElement) skillsAssessedElement.textContent = "0";

        if (overallMessage) {
            overallMessage.textContent =
                "Complete your self-assessment to view your progress report.";
        }

        if (skillProgressList) {
            skillProgressList.innerHTML =
                "<p>No assessment results found. Please complete the assessment first.</p>";
        }

        if (preparationCards) preparationCards.innerHTML = "";

        if (strongSkillsCount) strongSkillsCount.textContent = "0";
        if (improvementSkillsCount) improvementSkillsCount.textContent = "0";
        if (weakSkillsCount) weakSkillsCount.textContent = "0";
    }

    function renderProgress() {
        const result = readResult();

        if (
            !result ||
            !Array.isArray(result.skillResults) ||
            !result.skillResults.length
        ) {
            showNoResult();
            return;
        }

        const skills = result.skillResults.map(skill => {
            const score = Number(skill.score ?? 0);
            const total = Number(skill.total ?? skill.total_questions ?? 0);

            return {
                name: skill.skill_name || skill.skill || "Skill",
                score,
                total,
                percentage: total > 0
                    ? Math.round((score / total) * 100)
                    : 0
            };
        });

        const totalScore = skills.reduce(
            (sum, skill) => sum + skill.score, 0
        );

        const totalQuestions = skills.reduce(
            (sum, skill) => sum + skill.total, 0
        );

        const percentage = totalQuestions > 0
            ? Math.round((totalScore / totalQuestions) * 100)
            : Number(result.percentage ?? 0);

        const strongSkills = skills.filter(skill => skill.percentage >= 75);
        const improvementSkills = skills.filter(
            skill => skill.percentage >= 40 && skill.percentage < 75
        );
        const weakSkills = skills.filter(skill => skill.percentage < 40);

        progressDomain.textContent =
            result.domain ||
            localStorage.getItem("selectedDomain") ||
            "Not selected";

        if (overallPercentageElement) {
            overallPercentageElement.textContent = percentage + "%";
        }

        if (circlePercentage) circlePercentage.textContent = percentage + "%";
        if (correctAnswersElement) correctAnswersElement.textContent = totalScore;
        if (totalQuestionsElement) totalQuestionsElement.textContent = totalQuestions;
        if (skillsAssessedElement) skillsAssessedElement.textContent = skills.length;
        if (strongSkillsCount) strongSkillsCount.textContent = strongSkills.length;
        if (improvementSkillsCount) improvementSkillsCount.textContent = improvementSkills.length;
        if (weakSkillsCount) weakSkillsCount.textContent = weakSkills.length;

        if (overallMessage) {
            if (percentage >= 80) {
                overallMessage.textContent =
                    "Excellent work! Keep practising and try more advanced projects.";
            } else if (percentage >= 60) {
                overallMessage.textContent =
                    "Good progress! Strengthen the topics where you lost marks and practise with projects.";
            } else if (percentage >= 40) {
                overallMessage.textContent =
                    "You have a foundation to build on. Revise the basics and practise step by step.";
            } else {
                overallMessage.textContent =
                    "Start with the fundamentals of your selected skills and practise regularly.";
            }
        }

        if (skillProgressList) {
            skillProgressList.innerHTML = skills.map(skill => {
                let level = "Needs Improvement";

                if (skill.percentage >= 75) level = "Strong";
                else if (skill.percentage >= 40) level = "Developing";

                const safePercentage = Math.max(
                    0,
                    Math.min(100, skill.percentage)
                );

                return `
                    <div class="skill-progress-card">
                        <div class="skill-progress-header">
                            <h3>${escapeHTML(skill.name)}</h3>
                            <span>${skill.percentage}%</span>
                        </div>

                        <div
                            class="skill-progress-track"
                            style="width:100%;height:10px;background:#e5e7eb;border-radius:10px;overflow:hidden;"
                        >
                            <div
                                class="skill-progress-fill"
                                style="width:${safePercentage}%;height:100%;background:#4f46e5;border-radius:10px;"
                            ></div>
                        </div>

                        <p>Score: ${skill.score}/${skill.total} · ${level}</p>
                    </div>
                `;
            }).join("");
        }

        if (preparationCards) {
            const cards = [];

            if (weakSkills.length) {
                cards.push(`
                    <div class="preparation-card">
                        <h3>1. Revise the basics</h3>
                        <p>Focus first on: ${weakSkills.map(
                            skill => escapeHTML(skill.name)
                        ).join(", ")}.</p>
                    </div>
                `);
            }

            if (improvementSkills.length) {
                cards.push(`
                    <div class="preparation-card">
                        <h3>2. Practise and improve</h3>
                        <p>Work on: ${improvementSkills.map(
                            skill => escapeHTML(skill.name)
                        ).join(", ")}. Solve practice questions and exercises.</p>
                    </div>
                `);
            }

            if (strongSkills.length) {
                cards.push(`
                    <div class="preparation-card">
                        <h3>3. Build on your strengths</h3>
                        <p>Continue practising: ${strongSkills.map(
                            skill => escapeHTML(skill.name)
                        ).join(", ")}. Apply these skills in projects.</p>
                    </div>
                `);
            }

            if (!cards.length) {
                cards.push(`
                    <div class="preparation-card">
                        <h3>Your next step</h3>
                        <p>Review your skill-wise scores and practise one topic at a time.</p>
                    </div>
                `);
            }

            preparationCards.innerHTML = cards.join("");
        }
    }

    if (roadmapBtn) {
        roadmapBtn.textContent = "Continue to Recommendations →";

        roadmapBtn.addEventListener("click", function () {
            if (localStorage.getItem("assessmentCompleted") !== "true") {
                alert("Please complete the Self-Assessment first.");
                return;
            }

            window.location.href = "recommendation.html";
        });
    }

    renderProgress();
})();


// =====================================================
// 7. PROJECT RECOMMENDATIONS - ALL 12 DOMAINS
// =====================================================

(function () {
    const projectGrid = document.getElementById("projectGrid");

    // Run only on recommendation.html.
    if (!projectGrid) return;

    const recommendationMessage =
        document.getElementById("recommendationMessage");

    const recommendedSkills =
        document.getElementById("recommendedSkills");

    const projectDomain =
        document.getElementById("projectDomain");

    const officialResources =
        document.getElementById("officialResources");

    const youtubeResources =
        document.getElementById("youtubeResources");

    const googleResources =
        document.getElementById("googleResources");

    const practiceResources =
        document.getElementById("practiceResources");

    const learningRoadmap =
        document.getElementById("learningRoadmap");


    const catalogue = {
        "Web Development": {
            docs: [
                ["MDN Web Docs", "https://developer.mozilla.org/"],
                ["HTML Reference", "https://developer.mozilla.org/en-US/docs/Web/HTML"],
                ["CSS Reference", "https://developer.mozilla.org/en-US/docs/Web/CSS"],
                ["JavaScript Guide", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"]
            ],
            practice: [
                ["freeCodeCamp", "https://www.freecodecamp.org/"],
                ["Frontend Mentor", "https://www.frontendmentor.io/"],
                ["W3Schools", "https://www.w3schools.com/"]
            ],
            projects: [
                ["Personal Portfolio Website", "Create a responsive portfolio with projects and contact details."],
                ["Task Management App", "Build an app to add, edit, complete and delete tasks."],
                ["Career Opportunity Portal", "Create a portal with job cards, filters and application links."]
            ]
        },

        "Data Analytics": {
            docs: [
                ["Python Documentation", "https://docs.python.org/3/"],
                ["Pandas Documentation", "https://pandas.pydata.org/docs/"],
                ["PostgreSQL Documentation", "https://www.postgresql.org/docs/"],
                ["Power BI Learning", "https://learn.microsoft.com/en-us/power-bi/"]
            ],
            practice: [
                ["Kaggle", "https://www.kaggle.com/"],
                ["SQLBolt", "https://sqlbolt.com/"],
                ["HackerRank SQL", "https://www.hackerrank.com/domains/sql"]
            ],
            projects: [
                ["Retail Sales Dashboard", "Analyse sales, profit, product performance and regional trends."],
                ["Student Performance Analysis", "Explore marks, attendance and subject-wise performance."],
                ["Customer Segmentation", "Group customers by purchase behaviour and spending patterns."]
            ]
        },

        "AI & Machine Learning": {
            docs: [
                ["Scikit-learn", "https://scikit-learn.org/stable/"],
                ["TensorFlow", "https://www.tensorflow.org/"],
                ["PyTorch", "https://pytorch.org/"]
            ],
            practice: [
                ["Kaggle", "https://www.kaggle.com/"],
                ["Google Colab", "https://colab.research.google.com/"],
                ["Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course"]
            ],
            projects: [
                ["House Price Prediction", "Train a regression model on housing data."],
                ["Spam Message Classifier", "Classify messages using text features."],
                ["Customer Churn Prediction", "Predict which customers may stop using a service."]
            ]
        },

        "App Development": {
            docs: [
                ["Android Developers", "https://developer.android.com/"],
                ["Flutter Documentation", "https://docs.flutter.dev/"],
                ["React Native", "https://reactnative.dev/docs/getting-started"]
            ],
            practice: [
                ["Flutter Codelabs", "https://docs.flutter.dev/codelabs"],
                ["Android Training", "https://developer.android.com/courses"],
                ["GitHub", "https://github.com/"]
            ],
            projects: [
                ["Expense Tracker App", "Track expenses, categories and monthly spending."],
                ["Student Study Planner", "Organise subjects, assignments and study sessions."],
                ["Habit Tracker", "Record daily habits and show completion progress."]
            ]
        },

        "Cybersecurity": {
            docs: [
                ["OWASP", "https://owasp.org/"],
                ["NIST Cybersecurity", "https://www.nist.gov/cyberframework"],
                ["PortSwigger Web Security", "https://portswigger.net/web-security"]
            ],
            practice: [
                ["TryHackMe", "https://tryhackme.com/"],
                ["OverTheWire", "https://overthewire.org/wargames/"],
                ["OWASP Juice Shop", "https://owasp.org/www-project-juice-shop/"]
            ],
            projects: [
                ["Password Strength Checker", "Evaluate password strength locally using clear rules."],
                ["Security Log Analyzer", "Summarise sample logs and flag suspicious patterns."],
                ["Phishing Awareness Demo", "Create an educational demo that teaches users to identify suspicious messages."]
            ]
        },

        "Cloud Computing": {
            docs: [
                ["AWS Documentation", "https://docs.aws.amazon.com/"],
                ["Microsoft Azure", "https://learn.microsoft.com/en-us/azure/"],
                ["Google Cloud", "https://cloud.google.com/docs"]
            ],
            practice: [
                ["AWS Skill Builder", "https://skillbuilder.aws/"],
                ["Microsoft Learn", "https://learn.microsoft.com/"],
                ["Google Cloud Skills", "https://www.cloudskillsboost.google/"]
            ],
            projects: [
                ["Static Website Deployment", "Deploy a simple website using a cloud hosting service."],
                ["Cloud Backup Plan", "Design and document a safe backup and recovery workflow."],
                ["Cloud Cost Comparison", "Compare estimated costs for a sample application."]
            ]
        },

        "Database & SQL": {
            docs: [
                ["PostgreSQL", "https://www.postgresql.org/docs/"],
                ["MySQL Documentation", "https://dev.mysql.com/doc/"],
                ["W3Schools SQL", "https://www.w3schools.com/sql/"]
            ],
            practice: [
                ["SQLBolt", "https://sqlbolt.com/"],
                ["HackerRank SQL", "https://www.hackerrank.com/domains/sql"],
                ["LeetCode Database", "https://leetcode.com/problemset/database/"]
            ],
            projects: [
                ["Library Management Database", "Design tables for books, members, borrowing and returns."],
                ["College Management Database", "Create related tables for students, courses and enrolments."],
                ["Retail Order Analysis", "Use SQL joins and aggregations to analyse orders and sales."]
            ]
        },

        "Software Development": {
            docs: [
                ["Python Documentation", "https://docs.python.org/3/"],
                ["Git Documentation", "https://git-scm.com/doc"],
                ["GitHub Skills", "https://skills.github.com/"]
            ],
            practice: [
                ["Exercism", "https://exercism.org/"],
                ["HackerRank", "https://www.hackerrank.com/"],
                ["GitHub", "https://github.com/"]
            ],
            projects: [
                ["Personal Finance Tracker", "Record transactions and summarise spending."],
                ["Inventory Management System", "Track products, stock levels and updates."],
                ["Student Records System", "Store and search student information."]
            ]
        },

        "UI/UX Design": {
            docs: [
                ["Figma", "https://help.figma.com/"],
                ["Material Design", "https://m3.material.io/"],
                ["Nielsen Norman Group", "https://www.nngroup.com/articles/"]
            ],
            practice: [
                ["Figma Community", "https://www.figma.com/community"],
                ["Laws of UX", "https://lawsofux.com/"],
                ["Behance", "https://www.behance.net/"]
            ],
            projects: [
                ["College App Wireframes", "Design student login, timetable and notice screens."],
                ["Campus Website Redesign", "Improve the navigation and layout of a college website."],
                ["Usability Study", "Collect feedback on a prototype and document findings."]
            ]
        },

        "DevOps & Automation": {
            docs: [
                ["Docker", "https://docs.docker.com/"],
                ["GitHub Actions", "https://docs.github.com/en/actions"],
                ["Jenkins", "https://www.jenkins.io/doc/"]
            ],
            practice: [
                ["GitHub Skills", "https://skills.github.com/"],
                ["Docker Get Started", "https://docs.docker.com/get-started/"],
                ["GitHub Actions Guides", "https://docs.github.com/en/actions"]
            ],
            projects: [
                ["Automated Backup Script", "Automate backups of a sample project folder."],
                ["CI Workflow", "Run tests automatically when code is pushed."],
                ["Containerised Web App", "Package a simple application using Docker."]
            ]
        },

        "Blockchain Development": {
            docs: [
                ["Ethereum Documentation", "https://ethereum.org/developers/docs/"],
                ["Solidity Documentation", "https://docs.soliditylang.org/"],
                ["Hyperledger", "https://hyperledger-fabric.readthedocs.io/"]
            ],
            practice: [
                ["CryptoZombies", "https://cryptozombies.io/"],
                ["Remix IDE", "https://remix.ethereum.org/"],
                ["Ethereum Developer Resources", "https://ethereum.org/developers/"]
            ],
            projects: [
                ["Certificate Verification Demo", "Create a demo to verify certificate records."],
                ["Voting Smart Contract", "Build a test-only voting contract with clear rules."],
                ["Supply Chain Tracking Demo", "Record sample product stages in a simple ledger."]
            ]
        },

        "Data Science": {
            docs: [
                ["Pandas", "https://pandas.pydata.org/docs/"],
                ["NumPy", "https://numpy.org/doc/"],
                ["Scikit-learn", "https://scikit-learn.org/stable/"],
                ["Jupyter", "https://docs.jupyter.org/"]
            ],
            practice: [
                ["Kaggle", "https://www.kaggle.com/"],
                ["Google Colab", "https://colab.research.google.com/"],
                ["UCI Machine Learning Repository", "https://archive.ics.uci.edu/"]
            ],
            projects: [
                ["Exploratory Data Analysis", "Clean a dataset and explain patterns using charts."],
                ["Sales Forecasting", "Explore historical sales and build a baseline forecast."],
                ["Customer Behaviour Analysis", "Study customer groups and purchasing trends."]
            ]
        }
    };


    function makeLink(title, url) {
        return `
            <a href="${escapeHTML(url)}"
               target="_blank"
               rel="noopener noreferrer">
                ${escapeHTML(title)}
            </a>
        `;
    }

    function makeCard(title, description, url = "") {
        return `
            <div class="recommendation-card">
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(description)}</p>
                ${
                    url
                        ? `<p>${makeLink("Open resource →", url)}</p>`
                        : ""
                }
            </div>
        `;
    }

    function makeResourceList(items) {
        return items.map(item => `
            <div class="recommendation-card">
                <h3>${makeLink(item[0], item[1])}</h3>
            </div>
        `).join("");
    }

    function searchUrl(query, platform) {
        if (platform === "youtube") {
            return "https://www.youtube.com/results?search_query=" +
                encodeURIComponent(query);
        }

        return "https://www.google.com/search?q=" +
            encodeURIComponent(query);
    }

    function getSkillScore(skillName, results) {
        const result = results.find(item =>
            normalizeDomainName(item.skill_name || item.skill) ===
            normalizeDomainName(skillName)
        );

        if (!result) return null;

        const score = Number(result.score ?? 0);
        const total = Number(result.total ?? result.total_questions ?? 0);

        return total > 0 ? Math.round((score / total) * 100) : 0;
    }

    function clearRecommendationSections() {
        [
            recommendedSkills,
            officialResources,
            youtubeResources,
            googleResources,
            practiceResources,
            learningRoadmap
        ].forEach(element => {
            if (element) element.innerHTML = "";
        });

        projectGrid.innerHTML = "";
    }

    function renderRecommendations() {
        if (localStorage.getItem("assessmentCompleted") !== "true") {
            if (recommendationMessage) {
                recommendationMessage.textContent =
                    "Please complete your Self-Assessment before viewing project recommendations.";
            }

            clearRecommendationSections();
            projectGrid.innerHTML = makeCard(
                "Assessment Required",
                "Complete the assessment to get skill-wise recommendations and project ideas."
            );

            return;
        }

        const domain = localStorage.getItem("selectedDomain") || "";
        const selectedSkills = getStoredJSON("selectedSkills", []);
        const skillDetails = getStoredJSON("selectedSkillDetails", []);
        const result = getStoredJSON("skillResults", {});
        const skillResults = Array.isArray(result.skillResults)
            ? result.skillResults
            : [];

        const data = catalogue[domain];

        if (projectDomain) {
            projectDomain.textContent = domain || "Selected Domain";
        }

        if (recommendationMessage) {
            recommendationMessage.textContent =
                `Learning resources and project ideas for ${domain || "your selected domain"}.`;
        }

        clearRecommendationSections();

        if (!data) {
            projectGrid.innerHTML = makeCard(
                "Domain resources unavailable",
                "We could not find a resource catalogue for this domain. Try selecting one of the 12 available career domains."
            );
            return;
        }

        // Skill-wise recommendations.
        if (recommendedSkills) {
            if (!selectedSkills.length) {
                recommendedSkills.innerHTML = makeCard(
                    "No skills selected",
                    "Return to the Skills page to select skills for your learning plan."
                );
            } else {
                recommendedSkills.innerHTML = selectedSkills.map(skillName => {
                    const score = getSkillScore(skillName, skillResults);

                    let advice = "Start with the fundamentals, then practise with a small project.";

                    if (score !== null && score >= 75) {
                        advice = "Strong assessment result. Practise advanced questions and apply the skill in a project.";
                    } else if (score !== null && score >= 40) {
                        advice = "Developing skill. Revise weaker topics and practise regularly.";
                    } else if (score !== null) {
                        advice = "Prioritise the basics and complete guided exercises before moving to larger projects.";
                    }

                    const detail = skillDetails.find(
                        item => item.skill_name === skillName
                    );

                    const level = detail
                        ? detail.difficulty_level
                        : "Selected skill";

                    return makeCard(
                        skillName,
                        `${level} · ${score === null ? "Assessment score unavailable" : "Assessment score: " + score + "%"} · ${advice}`
                    );
                }).join("");
            }
        }

        // Official learning resources.
        if (officialResources) {
            officialResources.innerHTML = makeResourceList(data.docs);
        }

        // Practice platforms.
        if (practiceResources) {
            practiceResources.innerHTML = makeResourceList(data.practice);
        }

        // YouTube search links based on the selected skills.
        if (youtubeResources) {
            const skillsForVideos = selectedSkills.length
                ? selectedSkills
                : [domain];

            youtubeResources.innerHTML = skillsForVideos.map(skillName => {
                const url = searchUrl(
                    skillName + " tutorial for beginners",
                    "youtube"
                );

                return makeCard(
                    skillName + " - Video Tutorials",
                    "Find beginner-friendly explanations, demonstrations and guided practice videos.",
                    url
                );
            }).join("");
        }

        // Google search links for guides and practice.
        if (googleResources) {
            const searchTopics = selectedSkills.length
                ? selectedSkills
                : [domain];

            googleResources.innerHTML = searchTopics.map(skillName => {
                const url = searchUrl(
                    skillName + " learning roadmap practice exercises projects",
                    "google"
                );

                return makeCard(
                    skillName + " - Guides and Exercises",
                    "Search for tutorials, notes, exercises and project walkthroughs.",
                    url
                );
            }).join("");
        }

        // Project cards.
        if (projectGrid) {
            projectGrid.innerHTML = data.projects.map((project, index) => {
                const query = searchUrl(
                    project[0] + " " + domain + " project tutorial",
                    "google"
                );

                return makeCard(
                    `${index + 1}. ${project[0]}`,
                    project[1] + " Use the learning resources above to plan and build your own version.",
                    query
                );
            }).join("");
        }

        // Learning roadmap based on assessment score.
        if (learningRoadmap) {
            const overallPercentage = Number(
                result.percentage ??
                localStorage.getItem("assessmentScore") ??
                0
            );

            const steps = [];

            if (overallPercentage < 40) {
                steps.push(
                    ["Step 1: Strengthen the basics", "Review fundamental concepts for your selected skills."],
                    ["Step 2: Practise guided exercises", "Solve small problems and compare your work with examples."],
                    ["Step 3: Build a beginner project", "Choose one project idea and build it step by step."]
                );
            } else if (overallPercentage < 75) {
                steps.push(
                    ["Step 1: Revise weaker topics", "Use your skill-wise assessment results to decide what to revise."],
                    ["Step 2: Practise independently", "Solve exercises without following every step of a tutorial."],
                    ["Step 3: Build a practical project", "Create a project and document your approach and results."]
                );
            } else {
                steps.push(
                    ["Step 1: Test advanced concepts", "Practise more challenging problems and explore advanced features."],
                    ["Step 2: Build a complete project", "Create a project with a clear problem statement and measurable outcome."],
                    ["Step 3: Document and improve", "Write a README, test your work and improve it using feedback."]
                );
            }

            learningRoadmap.innerHTML = steps.map(step =>
                makeCard(step[0], step[1])
            ).join("");
        }
    }

    renderRecommendations();
})();
