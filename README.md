# CODEX ATLAS | Countdown v5, link condivisibile

Sito statico per GitHub Pages. La v5 conserva grafica, countdown, enigmi/profezie, animazioni, effetti audio e portale finale delle versioni precedenti. **Non serve alcun database.**

## Novità: la stessa scadenza per tutti

1. Apri il sito pubblico: `https://elmancino.github.io/CODEXATLAS/`.
2. Quando il vecchio countdown è scaduto, seleziona una **DATA** e un'**ORA** future e premi **ATTIVA COUNTDOWN**.
3. Compare il riquadro **LINK DEL COUNTDOWN PRONTO**: premi **COPIA LINK** e invialo ai giocatori (per esempio su WhatsApp).
4. Chi riceve il link vedrà automaticamente la stessa scadenza. **Non deve configurare nulla.**
5. Puoi riaprire la condivisione premendo il pulsante con tre punti collegati nell'intestazione, anche dopo un ricaricamento della pagina.

Il link contiene due date espresse come istanti assoluti ISO 8601 UTC, nei parametri `end` e `start`. Anche chi vive in un fuso diverso visualizza lo **stesso tempo residuo**. Il momento finale è condiviso; l'orologio dei dispositivi deve essere sufficientemente accurato per evitare differenze di alcuni secondi. Le date vengono inoltre conservate nel browser come nella v4.

**Attenzione:** su GitHub Pages il normale URL `https://elmancino.github.io/CODEXATLAS/` **non cambia da solo per gli altri giocatori**. Va condiviso **il link personalizzato generato** (contenente `?end=...&start=...`). Se in futuro cambierai ancora scadenza, dovrai inviare un nuovo link. Per cambiare la data comune sul normale URL senza parametri serve modificare `config.js` nella repository oppure introdurre un database.

Il link copiato punta al dominio pubblico impostato in `config.js` (`publicUrl`), anche se la pagina è aperta in locale. **Pubblica prima la v5 su GitHub Pages e poi condividi il link**; la v4 non è in grado di leggerne i parametri.

## Precedenza delle date

1. Link valido (`end` e `start`): **prevale sempre**, anche se quel browser aveva salvato in precedenza un'altra scadenza.
2. Preferenza già salvata nel browser: vale quando l'URL non specifica una coppia di date valida.
3. Date in `config.js`: valore iniziale per chi apre il sito senza link né salvataggi.

Le date predefinite in `config.js` sono scadute: il sito mostrerà la schermata di configurazione come nella v4.

## Pubblicazione su GitHub Pages

Estrai questo ZIP e copia tutti i file (compresa la cartella `assets/`) nella directory principale della repository `CODEXATLAS`, sovrascrivendo la vecchia versione. Esegui il commit sul ramo pubblicato da GitHub Pages. Verifica che l'indirizzo pubblico funzioni e aggiorna il browser con **Ctrl+F5** se mantiene la versione precedente.

## Compatibilità

Il sito resta ottimizzato per PC e smartphone. Lo schermo intero effettivo e l'audio necessitano di un gesto dell'utente per le limitazioni dei browser. Il link viene copiato tramite le API degli appunti, con selezione e copia manuale come alternativa. La modalità demo rimane rimossa.
