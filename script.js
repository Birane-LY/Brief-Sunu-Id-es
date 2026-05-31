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
  
  
  let selectedCategory = 'pedagogie';

  // --- GESTION DE LA FENÊTRE MODALE ---
  openModalBtn.addEventListener('click', () => {
    modalOverlay.classList.add('active');
  });

  closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
  });
  
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('active');
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
      
      // On retrouve la clé de catégorie en lisant la classe CSS (ex: cat-pedagogie -> pedagogie)
      let catValue = 'pedagogie';
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

    const catLabels = {
      'pedagogie': 'Pédagogie',
      'evenement': 'Événement',
      'campus': 'Vie de Campus',
      'technique': 'Technique'
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

        postIt.remove();
        saveToLocalStorage(); // <--- Sauvegarde après retrait temporaire pour modification
        modalOverlay.classList.add('active');
      }
    });

    // Ajouter le post-it au mur
    ideasWall.appendChild(postIt);
  };

  // --- SOUMISSION DU FORMULAIRE ---
  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const desc = descInput.value.trim();

    if (!title || !desc) {
      alert("Veuillez remplir le titre et la description !");
      return;
    }

    // Création visuelle du post-it
    createPostIt(title, desc, selectedCategory);
    
    saveToLocalStorage();

    // Réinitialisation du formulaire
    titleInput.value = '';
    descInput.value = '';
    selectedCategory = 'pedagogie';
    catButtons.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-cat="pedagogie"]').classList.add('active');

    modalOverlay.classList.remove('active');
  });

  // INITIALISATION : Charger les données existantes au démarrage de l'application
  loadFromLocalStorage();
});