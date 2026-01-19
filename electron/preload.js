const { contextBridge } = require('electron');

// Expõe APIs seguras para o frontend através da ponte de contexto
contextBridge.exposeInMainWorld('electronAPI', {
    // Você pode adicionar funções aqui no futuro para acessar recursos nativos
    version: process.versions.electron
});
