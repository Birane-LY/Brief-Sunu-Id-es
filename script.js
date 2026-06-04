import { OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } from '/env.js';

document.addEventListener('DOMContentLoaded', () => {

  const openModalBtn  = document.getElementById('open-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalOverlay  = document.getElementById('modal-overlay');
  const submitBtn     = document.getElementById('submit-btn');
  const ideasWall     = document.getElementById('ideas-wall');
  const titleInput    = document.getElementById('task-title');
  const descInput     = document.getElementById('task-desc');
  const catButtons    = document.querySelectorAll('.category-btn');
  
  const CAT_LABELS = {
    'pedagogie': 'Pédagogie',
    'evenement': 'Événement',
    'campus':    'Vie de Campus',
    'technique': 'Technique',
    'autre':     'Autre'
  };

  const VALID_CATEGORIES = Object.keys(CAT_LABELS);
  let selectedCategory = 'pedagogie';
  let currentEditingPostIt = null;

  if (typeof supabase === 'undefined') {
    console.error("La bibliothèque Supabase n'est pas chargée.");
    return;
  }

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const SYSTEM_PROMPT = `Tu es un moteur de classification sémantique pour l'application "Sunu Idées". Tu agis comme une API déterministe.
Ton unique objectif est d'assigner une catégorie valide à partir d'un titre et d'une description fournis.
Catégories autorisées : "pedagogie", "evenement", "campus", "technique", "autre".
Référentiel métier :
- pedagogie : cours, enseignement, apprentissage, examens, évaluations, révisions, ateliers, projets, formateurs.
- evenement : conférences, hackathons, compétitions, cérémonies, séminaires, meetups, webinaires, fêtes.
- campus : infrastructures, bâtiments, salles, bibliothèque, cafétéria, vie étudiante, clubs, BDE, confort.
- technique : bugs, incidents, développement logiciel, applications, sites, serveurs, wifi, réseaux, ordinateurs, matériel.
Format de sortie obligatoire : Réponds exclusivement avec un objet JSON valide. Aucun texte supplémentaire. Aucune balise Markdown.
Structure attendue : {"category": "pedagogie|evenement|campus|technique|autre"}`;

  // --- HELPERS VALIDATION ---

  function showError(element, message) {
    const formGroup = element.closest('.input-area'); 
    formGroup.classList.remove('success');
    formGroup.classList.add('error');
    if (!formGroup.querySelector('.error-message')) {
      const errDiv = document.createElement('div');
      errDiv.classList.add('error-message');
      errDiv.textContent = message;
      formGroup.appendChild(errDiv);
    }
  }

  function showSuccess(element) {
    const formGroup = element.closest('.input-area');
    formGroup.classList.remove('error');
    formGroup.classList.add('success');
    const oldErr = formGroup.querySelector('.error-message');
    if (oldErr) oldErr.remove();
  }

  function clearErrors() {
    document.querySelectorAll('.error-message').forEach(m => m.remove());
    document.querySelectorAll('.input-area').forEach(g => {
      g.classList.remove('error', 'success');
    });
  }

  const voyelles  = '[aàâæeéèêëiîïoôœuùûüyÿ]';
  const consonnes = '[bcçdfghjklmnpqrstvwxz]';
  const regexDoubleStart = new RegExp(`^(?:(${voyelles})\\1|(${consonnes})\\2)`, 'i');
  const regexDoubleEnd   = new RegExp(`(?:(${voyelles})\\1|(${consonnes})\\2)$`, 'i');


  function validateTitleValue(value) {
    if (value === '') {
      return 'Veuillez remplir le champ titre.';
    } else if (value.length < 5 || value.length > 30) {
      return 'Votre titre doit contenir entre 5 et 30 caractères.';
    } else if (regexDoubleStart.test(value) || regexDoubleEnd.test(value)) {
      return 'Soyez explicite dans le sens des mots que vous utilisez.';
    }
    return null; 
  }


  function validateDescValue(value) {
    if (value === '') {
      return "N'oublie pas de décrire ton idée.";
    } else if (value.length < 25) {
      return 'Votre description est trop courte (minimum 25 caractères).';
    } else if (value.length > 255) {
      return 'La description est limitée à 255 caractères.';
    }
    return null;
  }


  // Validation au blur (quand l'utilisateur quitte le champ)
  titleInput.addEventListener('blur', () => {
    const err = validateTitleValue(titleInput.value.trim());
    if (err) showError(titleInput, err);
    else showSuccess(titleInput);
  });

  descInput.addEventListener('blur', () => {
    const err = validateDescValue(descInput.value.trim());
    if (err) showError(descInput, err);
    else showSuccess(descInput);
  });

  // --- FORMULAIRE ---

  const resetForm = () => {
    titleInput.value = '';
    descInput.value  = '';
    selectedCategory = 'pedagogie';
    clearErrors();
    catButtons.forEach(btn => {
      if (btn.getAttribute('data-cat') === 'pedagogie') btn.classList.add('active');
      else btn.classList.remove('active');
    });
  };

  openModalBtn.addEventListener('click', () => {
    currentEditingPostIt = null;
    resetForm();
    document.querySelector('.sunu-app h2').textContent = "Partagez votre idée";
    submitBtn.textContent = "Ajouter au mur";
    submitBtn.disabled = false;
    modalOverlay.classList.add('active');
  });

  const closeModal = () => {
    if (currentEditingPostIt) currentEditingPostIt.classList.remove('editing-mode');
    resetForm();
    currentEditingPostIt = null;
    modalOverlay.classList.remove('active');
  };

  closeModalBtn.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  const modalCard = modalOverlay.querySelector('.sunu-app') || modalOverlay.firstElementChild;
  if (modalCard) modalCard.addEventListener('click', (e) => e.stopPropagation());

  catButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const clickedBtn = e.currentTarget;
      catButtons.forEach(b => b.classList.remove('active'));
      clickedBtn.classList.add('active');
      selectedCategory = clickedBtn.getAttribute('data-cat');
    });
  });

  // --- SUPABASE ---

  const loadFromSupabase = async () => {
    try {
      const { data: ideasArray, error } = await supabaseClient
        .from('ideas').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (ideasArray) {
        ideasWall.querySelectorAll('.post-it').forEach(p => p.remove());
        ideasArray.forEach(idea => {
          createPostIt(idea.title, idea.description, idea.category, idea.completed, idea.id);
        });
      }
    } catch (error) {
      console.error("Erreur de chargement Supabase :", error);
    }
  };

  const createPostIt = (titleText, descText, catValue, isCompleted = false, dbId = null) => {
    const postIt = document.createElement('div');
    postIt.classList.add('post-it', `cat-${catValue}`);
    if (dbId) postIt.setAttribute('data-db-id', dbId);
    if (isCompleted) postIt.classList.add('completed');

    postIt.innerHTML = `
      <div class="post-it-header">
        <span class="task-badge">${CAT_LABELS[catValue] || CAT_LABELS['autre']}</span>
        <input type="checkbox" class="checkbox" ${isCompleted ? 'checked' : ''}>
      </div>
      <div class="post-it-body">
        <h3 class="task-title-text"></h3>
        <p class="task-desc-text"></p>
      </div>
      <div class="post-it-footer">
        <button class="edit-btn" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div>`;

    postIt.querySelector('.task-title-text').textContent = titleText;
    postIt.querySelector('.task-desc-text').textContent  = descText;

    const checkbox = postIt.querySelector('.checkbox');

    checkbox.addEventListener('change', async () => {
      postIt.classList.toggle('completed', checkbox.checked);
      if (dbId) {
        const { error } = await supabaseClient.from('ideas')
          .update({ completed: checkbox.checked }).eq('id', dbId);
        if (error) console.error("Erreur mise à jour completed :", error);
      }
    });

    postIt.querySelector('.delete-btn').addEventListener('click', async () => {
      if (dbId) {
        const { error } = await supabaseClient.from('ideas').delete().eq('id', dbId);
        if (!error) postIt.remove();
        else console.error("Erreur suppression :", error);
      } else {
        postIt.remove();
      }
    });

    postIt.querySelector('.edit-btn').addEventListener('click', () => {
      if (!checkbox.checked) {
        currentEditingPostIt = postIt;
        postIt.classList.add('editing-mode');
        titleInput.value = postIt.querySelector('.task-title-text').textContent;
        descInput.value  = postIt.querySelector('.task-desc-text').textContent;
        selectedCategory = catValue;
        catButtons.forEach(btn => {
          if (btn.getAttribute('data-cat') === catValue) btn.classList.add('active');
          else btn.classList.remove('active');
        });
        document.querySelector('.sunu-app h2').textContent = "Modifier votre idée";
        submitBtn.textContent = "Mettre à jour l'idée";
        submitBtn.disabled = false;
        modalOverlay.classList.add('active');
      }
    });

    ideasWall.appendChild(postIt);
  };

  // --- IA ---

  const parseAIResponse = (rawText) => {
    const cleaned = rawText.trim()
    return JSON.parse(cleaned);
  };

  const classifyWithAI = async (title, desc, fallbackCategory) => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.href,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b:free",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: `Titre: ${title}\nDescription: ${desc}` }
          ],
          reasoning_effort: "low",
          max_completion_tokens: 100,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Erreur HTTP OpenRouter ${response.status} : ${errBody}`);
      }

      const result  = await response.json();
      const rawText = result?.choices?.[0]?.message?.content;
      if (!rawText) throw new Error("Réponse vide du modèle");

      const aiJson = parseAIResponse(rawText);
      if (aiJson && VALID_CATEGORIES.includes(aiJson.category)) {
        console.log(`Catégorie IA retenue : ${aiJson.category}`);
        return aiJson.category;
      }
      throw new Error(`Catégorie invalide : ${aiJson?.category}`);

    } catch (error) {
      console.warn("Fallback sur catégorie manuelle :", error.message);
      return fallbackCategory;
    }
  };

  // --- SOUMISSION ---

  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearErrors();

    //  FIX : title et desc, pas titleValue/descValue
    const title = titleInput.value.trim();
    const desc  = descInput.value.trim();

    let isValid = true;

    const titleErr = validateTitleValue(title);
    if (titleErr) { showError(titleInput, titleErr); isValid = false; }
    else showSuccess(titleInput);

    const descErr = validateDescValue(desc);
    if (descErr) { showError(descInput, descErr); isValid = false; }
    else showSuccess(descInput);

    if (!isValid) return;

    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = "Classification IA en cours...";
    submitBtn.disabled = true;

    const finalCategory = await classifyWithAI(title, desc, selectedCategory);

    try {
      if (currentEditingPostIt) {
        const dbId = currentEditingPostIt.getAttribute('data-db-id');
        if (dbId) {
          const { error } = await supabaseClient.from('ideas')
            .update({ title, description: desc, category: finalCategory }).eq('id', dbId);
          if (error) throw error;
        }
        currentEditingPostIt.querySelector('.task-title-text').textContent = title;
        currentEditingPostIt.querySelector('.task-desc-text').textContent  = desc;
        currentEditingPostIt.className = 'post-it';
        currentEditingPostIt.classList.add(`cat-${finalCategory}`);
        if (currentEditingPostIt.querySelector('.checkbox').checked) {
          currentEditingPostIt.classList.add('completed');
        }
        currentEditingPostIt.querySelector('.task-badge').textContent =
          CAT_LABELS[finalCategory] || CAT_LABELS['autre'];

      } else {
        const { data, error } = await supabaseClient.from('ideas')
          .insert([{ title, description: desc, category: finalCategory, completed: false }])
          .select();
        if (error) throw error;
        if (data && data[0]) createPostIt(title, desc, finalCategory, false, data[0].id);
      }

      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
      closeModal();

    } catch (dbError) {
      console.error("Échec de l'enregistrement Supabase :", dbError);
      alert("Impossible de sauvegarder l'idée. Vérifiez la console.");
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
  });

  loadFromSupabase();
});


