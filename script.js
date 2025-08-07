// État de l'application
const appState = {
    isReading: false,
    isWriting: false,
    history: JSON.parse(localStorage.getItem('nfc-history') || '[]')
};

// Éléments DOM
const elements = {
    status: document.getElementById('status'),
    compatibility: document.getElementById('compatibility'),
    readBtn: document.getElementById('readBtn'),
    writeBtn: document.getElementById('writeBtn'),
    writeData: document.getElementById('writeData'),
    recordType: document.getElementById('recordType'),
    readResult: document.getElementById('readResult'),
    readData: document.getElementById('readData'),
    writeResult: document.getElementById('writeResult'),
    writeStatus: document.getElementById('writeStatus'),
    history: document.getElementById('history'),
    clearHistory: document.getElementById('clearHistory'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalContent: document.getElementById('modalContent'),
    closeModal: document.getElementById('closeModal')
};

// Vérification de la compatibilité
function checkCompatibility() {
    if (!('NDEFReader' in window)) {
        elements.compatibility.style.display = 'block';
        elements.status.textContent = 'API Web NFC non disponible';
        elements.readBtn.disabled = true;
        elements.writeBtn.disabled = true;
        return false;
    }
    return true;
}

// Mise à jour du statut
function updateStatus(message, type = 'info') {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
}

// Formatage des données NDEF
function formatNDEFData(records) {
    return records.map(record => {
        const decoder = new TextDecoder();
        let data = '';
        
        try {
            data = decoder.decode(record.data);
        } catch (e) {
            data = Array.from(new Uint8Array(record.data))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
        }

        return {
            recordType: record.recordType,
            mediaType: record.mediaType || 'N/A',
            id: record.id || 'N/A',
            data: data,
            lang: record.lang || 'N/A'
        };
    });
}

// Affichage des données formatées
function displayFormattedData(container, data) {
    container.innerHTML = '';
    
    data.forEach((record, index) => {
        const recordDiv = document.createElement('div');
        recordDiv.style.marginBottom = '1rem';
        recordDiv.style.padding = '1rem';
        recordDiv.style.border = '1px solid var(--border)';
        recordDiv.style.borderRadius = 'var(--radius)';
        recordDiv.style.background = 'var(--surface)';
        
        recordDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--primary-color);">
                Enregistrement ${index + 1}
            </div>
            <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                <strong>Type:</strong> ${record.recordType}<br>
                <strong>Media Type:</strong> ${record.mediaType}<br>
                <strong>ID:</strong> ${record.id}<br>
                <strong>Langue:</strong> ${record.lang}
            </div>
            <div style="font-weight: 500; margin-bottom: 0.25rem;">Données:</div>
            <div style="font-family: 'Courier New', monospace; background: var(--border-light); padding: 0.5rem; border-radius: 4px; word-break: break-all;">
                ${record.data}
            </div>
        `;
        
        container.appendChild(recordDiv);
    });
}

// Lecture NFC
async function readNFC() {
    if (appState.isReading) return;
    
    try {
        appState.isReading = true;
        elements.readBtn.textContent = '🔍 Approchez une carte NFC...';
        elements.readBtn.disabled = true;
        updateStatus('En attente d\'une carte NFC...', 'reading');

        const ndef = new NDEFReader();
        await ndef.scan();

        const readPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout de lecture (30s)'));
            }, 30000);

            ndef.addEventListener('reading', ({ message, serialNumber }) => {
                clearTimeout(timeout);
                resolve({ message, serialNumber });
            });

            ndef.addEventListener('readingerror', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });

        const { message, serialNumber } = await readPromise;
        const formattedData = formatNDEFData(message.records);
        
        // Affichage des résultats
        displayFormattedData(elements.readData, formattedData);
        elements.readResult.style.display = 'block';
        
        // Ajout à l'historique
        addToHistory('read', {
            serialNumber,
            records: formattedData,
            timestamp: new Date().toISOString()
        });
        
        updateStatus('Lecture réussie !', 'success');
        
    } catch (error) {
        console.error('Erreur de lecture NFC:', error);
        updateStatus(`Erreur: ${error.message}`, 'error');
        elements.readResult.style.display = 'none';
    } finally {
        appState.isReading = false;
        elements.readBtn.textContent = '🔍 Commencer la lecture';
        elements.readBtn.disabled = false;
    }
}

// Écriture NFC
async function writeNFC() {
    if (appState.isWriting || !elements.writeData.value.trim()) return;
    
    try {
        appState.isWriting = true;
        elements.writeBtn.textContent = '✍️ Approchez une carte NFC...';
        elements.writeBtn.disabled = true;
        updateStatus('Prêt pour l\'écriture...', 'writing');

        const ndef = new NDEFReader();
        const data = elements.writeData.value.trim();
        const recordType = elements.recordType.value;
        
        let record;
        switch (recordType) {
            case 'url':
                record = { recordType: 'url', data };
                break;
            case 'mime':
                record = { recordType: 'mime', mediaType: 'text/plain', data };
                break;
            default:
                record = { recordType: 'text', data };
        }

        await ndef.write({ records: [record] });
        
        // Affichage du succès
        elements.writeStatus.textContent = 'Écriture réussie !';
        elements.writeStatus.className = 'status-message success';
        elements.writeResult.style.display = 'block';
        
        // Ajout à l'historique
        addToHistory('write', {
            recordType,
            data,
            timestamp: new Date().toISOString()
        });
        
        updateStatus('Écriture réussie !', 'success');
        
        // Réinitialisation du formulaire
        elements.writeData.value = '';
        
    } catch (error) {
        console.error('Erreur d\'écriture NFC:', error);
        elements.writeStatus.textContent = `Erreur: ${error.message}`;
        elements.writeStatus.className = 'status-message error';
        elements.writeResult.style.display = 'block';
        updateStatus(`Erreur: ${error.message}`, 'error');
    } finally {
        appState.isWriting = false;
        elements.writeBtn.textContent = '✍️ Écrire sur la carte';
        updateWriteButtonState();
    }
}

// Gestion de l'historique
function addToHistory(type, data) {
    const historyItem = {
        id: Date.now(),
        type,
        data,
        timestamp: new Date().toISOString()
    };
    
    appState.history.unshift(historyItem);
    
    // Limiter à 50 éléments
    if (appState.history.length > 50) {
        appState.history = appState.history.slice(0, 50);
    }
    
    localStorage.setItem('nfc-history', JSON.stringify(appState.history));
    renderHistory();
}

function renderHistory() {
    if (appState.history.length === 0) {
        elements.history.innerHTML = '<p class="empty-state">Aucune opération effectuée</p>';
        return;
    }
    
    elements.history.innerHTML = appState.history
        .map(item => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleString('fr-FR');
            const typeIcon = item.type === 'read' ? '📖' : '✏️';
            const typeText = item.type === 'read' ? 'Lecture' : 'Écriture';
            
            let preview = '';
            if (item.type === 'read') {
                preview = `${item.data.records.length} enregistrement(s)`;
                if (item.data.serialNumber) {
                    preview += ` • SN: ${item.data.serialNumber.substring(0, 8)}...`;
                }
            } else {
                preview = item.data.data.substring(0, 50);
                if (item.data.data.length > 50) preview += '...';
            }
            
            return `
                <div class="history-item" onclick="showHistoryDetails(${item.id})">
                    <div class="history-item-header">
                        <span class="history-item-type">${typeIcon} ${typeText}</span>
                        <span class="history-item-time">${timeStr}</span>
                    </div>
                    <div class="history-item-data">${preview}</div>
                </div>
            `;
        })
        .join('');
}

function showHistoryDetails(id) {
    const item = appState.history.find(h => h.id === id);
    if (!item) return;
    
    elements.modalTitle.textContent = `Détails - ${item.type === 'read' ? 'Lecture' : 'Écriture'}`;
    elements.modalContent.textContent = JSON.stringify(item.data, null, 2);
    elements.modal.style.display = 'flex';
}

function clearHistory() {
    if (confirm('Êtes-vous sûr de vouloir effacer l\'historique ?')) {
        appState.history = [];
        localStorage.removeItem('nfc-history');
        renderHistory();
        updateStatus('Historique effacé', 'info');
    }
}

// Gestion de l'état du bouton d'écriture
function updateWriteButtonState() {
    const hasData = elements.writeData.value.trim().length > 0;
    const isAvailable = checkCompatibility() && !appState.isWriting;
    elements.writeBtn.disabled = !hasData || !isAvailable;
}

// Gestion du modal
function closeModal() {
    elements.modal.style.display = 'none';
}

// Gestion des événements
function setupEventListeners() {
    elements.readBtn.addEventListener('click', readNFC);
    elements.writeBtn.addEventListener('click', writeNFC);
    elements.writeData.addEventListener('input', updateWriteButtonState);
    elements.clearHistory.addEventListener('click', clearHistory);
    elements.closeModal.addEventListener('click', closeModal);
    
    // Fermer le modal en cliquant à l'extérieur
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeModal();
        }
    });
    
    // Fermer le modal avec Échap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal.style.display !== 'none') {
            closeModal();
        }
    });
}

// Initialisation
function init() {
    console.log('🚀 Initialisation de NFC Connect');
    
    if (checkCompatibility()) {
        updateStatus('Prêt à utiliser', 'success');
    }
    
    setupEventListeners();
    renderHistory();
    updateWriteButtonState();
    
    console.log('✅ Application initialisée');
}

// Fonction globale pour l'historique (appelée depuis le HTML)
window.showHistoryDetails = showHistoryDetails;

// Démarrage de l'application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
