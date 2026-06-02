document.addEventListener('DOMContentLoaded', () => {
  // Sélection des éléments de l'interface
  const openModalBtn = document.getElementById('open-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalOverlay = document.getElementById('modal-overlay');
  const submitBtn = document.getElementById('submit-btn');
  const ideasWall = document.getElementById('ideas-wall');
  
  // Sélection des éléments du formulaire 
  const titleInput = document.getElementById('task-title');
  const descInput = document.getElementById('task-desc');
  const catButtons = document.querySelectorAll('.category-btn');
  
  // --- VARIABLES D'ÉTAT DE L'APPLICATION ---
  let selectedCategory = 'pedagogie';
  // Variable d'état cruciale pour corriger l'édition destructive
  let currentEditingPostIt = null; 

  // --- GESTION DE LA FENÊTRE MODALE ---
  openModalBtn.addEventListener('click', () => {
    currentEditingPostIt = null; // Mode création pure
    document.querySelector('.sunu-app h2').textContent = "Partagez votre idée";
    submitBtn.textContent = "Ajouter au mur";
    titleInput.value = '';
    descInput.value = '';
    modalOverlay.classList.add('active');
  });

  // Fonction centrale pour fermer proprement la modale
  const closeModal = () => {
    if (currentEditingPostIt) {
      currentEditingPostIt.classList.remove('editing-mode'); // Supprime l'indicateur visuel d'attente
    }
    currentEditingPostIt = null;
    modalOverlay.classList.remove('active');
  };

  closeModalBtn.addEventListener('click', closeModal);
  
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // --- GESTION DES BOUTONS DE CATÉGORIE ---
  catButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      catButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedCategory = e.target.getAttribute('data-cat');
    });
  });

  // ====================================================
  //  LOGIQUE LOCALSTORAGE (SAUVEGARDE ET CHARGEMENT)
  // ====================================================

  // Fonction pour sauvegarder tout l'état du mur dans le LocalStorage
  const saveToLocalStorage = () => {
    const ideas = [];
    const postIts = ideasWall.querySelectorAll('.post-it');
    
    postIts.forEach(postIt => {
      const title = postIt.querySelector('.task-title-text').textContent;
      const desc = postIt.querySelector('.task-desc-text').textContent;
      const isCompleted = postIt.querySelector('.checkbox').checked;
      
      // On retrouve la clé de catégorie en lisant la classe CSS
      let catValue = 'autre'; // Valeur par défaut
      if (postIt.classList.contains('cat-pedagogie')) catValue = 'pedagogie';
      if (postIt.classList.contains('cat-evenement')) catValue = 'evenement';
      if (postIt.classList.contains('cat-campus')) catValue = 'campus';
      if (postIt.classList.contains('cat-technique')) catValue = 'technique';

      ideas.push({ title, desc, category: catValue, completed: isCompleted });
    });

    localStorage.setItem('sunu_ideas', JSON.stringify(ideas));
  };

  // Fonction pour charger les données du LocalStorage au démarrage
  const loadFromLocalStorage = () => {
    const savedIdeas = localStorage.getItem('sunu_ideas');
    if (savedIdeas) {
      const ideasArray = JSON.parse(savedIdeas);
      ideasArray.forEach(idea => {
        createPostIt(idea.title, idea.desc, idea.category, idea.completed);
      });
    }
  };

  // --- FONCTION DE CRÉATION DE POST-IT ---
  const createPostIt = (titleText, descText, catValue, isCompleted = false) => {
    const postIt = document.createElement('div');
    postIt.classList.add('post-it', `cat-${catValue}`);
    if (isCompleted) {
      postIt.classList.add('completed');
    }

    // Référentiel étendu avec la catégorie d'intégration "autre"
    const catLabels = {
      'pedagogie': 'Pédagogie',
      'evenement': 'Événement',
      'campus': 'Vie de Campus',
      'technique': 'Technique',
      'autre': 'Autre'
    };

    postIt.innerHTML = `
      <div class="post-it-header">
        <span class="task-badge">${catLabels[catValue] || 'Autre'}</span>
        <input type="checkbox" class="checkbox" ${isCompleted ? 'checked' : ''}>
      </div>
      <div class="post-it-body">
        <h3 class="task-title-text">${titleText}</h3>
        <p class="task-desc-text">${descText}</p>
      </div>
      <div class="post-it-footer">
        <button class="edit-btn" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

    // Événement : Cocher la case 
    const checkbox = postIt.querySelector('.checkbox');
    checkbox.addEventListener('change', () => {
      postIt.classList.toggle('completed', checkbox.checked);
      saveToLocalStorage();
    });

    // Événement : Supprimer le post-it
    const deleteBtn = postIt.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      postIt.remove();
      saveToLocalStorage(); 
    });

    // Événement : Modifier le post-it 
    const editBtn = postIt.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => {
      if (!checkbox.checked) {
        currentEditingPostIt = postIt;
        postIt.classList.add('editing-mode'); 

        // Étape 2 : Pré-remplissage des champs de saisie
        titleInput.value = postIt.querySelector('.task-title-text').textContent;
        descInput.value = postIt.querySelector('.task-desc-text').textContent;
        
        selectedCategory = catValue;
        catButtons.forEach(btn => {
          if (btn.getAttribute('data-cat') === catValue) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });

        // Étape 3 : Modification des intitulés textuels de la modale pour le contexte
        document.querySelector('.sunu-app h2').textContent = "Modifier votre idée";
        submitBtn.textContent = "Mettre à jour l'idée";
        
        modalOverlay.classList.add('active');
      }
    });

    // Ajouter le post-it au mur
    ideasWall.appendChild(postIt);
  };

  // --- SOUMISSION ET ROUTAGE DU FORMULAIRE (AVEC OLLAMA ASYNC) ---
  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault(); 

    const title = titleInput.value.trim(); 
    const desc = descInput.value.trim();   

    if (!title || !desc) {
      alert("Veuillez remplir le titre et la description !");
      return;
    }

    // 1. Changement d'état visuel immédiat pour bloquer l'interface
    submitBtn.textContent = "Classification IA en cours...";
    submitBtn.disabled = true;

    let finalCategory = "autre"; 

    // 2. Appel du modèle local Ollama (Traitement sémantique asynchrone)
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "sunu-classifier", 
          prompt: `title: "${title}"\ndescription: "${desc}"`,
          format: "json",         
          stream: false             
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiResult = JSON.parse(data.response);
        
        const validCategories = ['pedagogie', 'evenement', 'campus', 'technique'];
        if (validCategories.includes(aiResult.category)) {
          finalCategory = aiResult.category;
        }
      }
    } catch (error) {
      console.error("Ollama est inaccessible. Attribution de la catégorie par défaut : autre.", error);
    }

    // 3. LOGIQUE DE ROUTAGE SÉCURISÉE (Création vs Modification)
    if (currentEditingPostIt) {
      // MODE ÉDITION : Mise à jour chirurgicale directement sur les nœuds existants
      currentEditingPostIt.querySelector('.task-title-text').textContent = title;
      currentEditingPostIt.querySelector('.task-desc-text').textContent = desc;
      
      // Reconstruction propre de la liste des classes CSS
      currentEditingPostIt.className = 'post-it'; 
      currentEditingPostIt.classList.add(`cat-${finalCategory}`);
      if (currentEditingPostIt.querySelector('.checkbox').checked) {
        currentEditingPostIt.classList.add('completed');
      }
      
      // Changement du libellé du badge textuel
      const catLabels = {
        'pedagogie': 'Pédagogie', 'evenement': 'Événement', 
        'campus': 'Vie de Campus', 'technique': 'Technique', 'autre': 'Autre'
      };
      currentEditingPostIt.querySelector('.task-badge').textContent = catLabels[finalCategory] || 'Autre';
      currentEditingPostIt.classList.remove('editing-mode');
    } else {
      // MODE CRÉATION : Génération d'une nouvelle carte graphique sur le mur
      createPostIt(title, desc, finalCategory);
    }

    // 4. Sauvegarde dans le LocalStorage de l'état consolidé
    saveToLocalStorage();
    
    // 5. Réinitialisation complète du formulaire 
    titleInput.value = '';
    descInput.value = '';
    currentEditingPostIt = null; // Libération de la mémoire
    
    catButtons.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-cat="pedagogie"]').classList.add('active'); 
    
    // Rétablissement des attributs du bouton de soumission
    submitBtn.textContent = "Ajouter au mur";
    submitBtn.disabled = false;
    
    // Fermeture de la modale 
    modalOverlay.classList.remove('active');
  });

  // INITIALISATION : Charger les données existantes au démarrage de l'application
  loadFromLocalStorage();
});