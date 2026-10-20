# Code Alkhayrat

Site d’entraînement au code de la route, avec un studio local de gestion des séries et des questions. Le site élève reste en arabe (RTL), l’administration est en français.

## Aperçu local

Installer Node.js 20 ou plus récent et Git, puis lancer `npm ci` et `npm start`.

- Studio : `http://localhost:5080/`
- Site élève : `http://localhost:5080/preview/`

Le PC local est autorisé. Un téléphone du même réseau doit scanner un QR temporaire créé depuis le PC ; sa session dure 12 heures et disparaît au redémarrage du serveur. Les appels d’écriture sont protégés contre les origines étrangères. Ne pas exposer ce serveur sur Internet, ni transférer ses ports dans le routeur.

## Contenu et publication

- `public/` : interface d’administration et éditeur de questions.
- `docs/` : site élève publié, avec les styles `modern.css` et `session.css`. Le test utilise `test-classic.css` pour conserver son interface d’origine, son loader central et le démarrage en plein écran.
- `db.json` : données de travail du studio.
- `docs/db.js` : export des données utilisé par le site élève.

Enregistrer sauvegarde la question et la description de la série. Synchroniser prépare l’export du site. Publier synchronise, crée un commit si nécessaire et envoie vers `origin/main`, après confirmation. Seuls `db.json`, `docs/db.js` et `docs/assets/` sont préparés : pas de paramètres privés ou de code sans rapport. Un conflit distant est refusé, sans forçage ; les données et commits locaux sont conservés. « Vérifier l’accès GitHub » effectue un envoi à blanc, sans publication.

## Téléphone et enregistrements

- « Ouvrir sur téléphone » dans le menu affiche un QR de connexion à usage unique, valable deux minutes. Le PC et le téléphone doivent être sur le même réseau local.
- Dans Question audio ou Explication audio, « Téléphone » crée un QR réservé à cette question et à ce champ, valable 15 minutes. Il ne donne pas accès au reste de l’administration.
- Enregistrer sur le téléphone, écouter puis envoyer. Le studio reçoit l’audio dans le brouillon ; cliquer sur Enregistrer pour le sauvegarder. Fermer le QR annule le transfert. Limite : cinq minutes d’enregistrement dans la page, fichier de 25 Mo maximum.
- Le microphone d’un navigateur mobile exige HTTPS. Au premier accès, télécharger le certificat local depuis l’aide du QR, comparer son empreinte avec le PC, puis l’installer comme certificat de confiance sur le téléphone. Sur iPhone, activer aussi sa confiance dans Réglages → Général → Informations → Réglages des certificats. Aucune modification de confiance du système n’est effectuée automatiquement. L’enregistreur natif/import de fichier reste disponible via le lien HTTP si l’on ne souhaite pas installer ce certificat.
- Les clés HTTPS, sessions et audios temporaires sont locaux dans `.studio/`, exclu de Git. Le certificat public seul peut être téléchargé. Les transferts expirent ; ils ne sont pas sauvegardés dans la base avant validation depuis l’éditeur.

## Installation Windows

Le studio est indépendant de l’application de gestion des candidats. Utiliser un dossier séparé (par exemple `C:\Users\Guest_\CodeAlkhayratStudio`) et conserver les ports 5080 et 5443.

1. Cloner ce dépôt dans le dossier choisi.
2. En PowerShell administrateur, lancer `windows\Prepare-Git.ps1 -TargetUser Guest_`. Autoriser sa **clé publique** dans GitHub → dépôt → Settings → Deploy keys, avec accès en écriture. La clé privée ne quitte pas Windows ; aucune clé personnelle Mac ou jeton GitHub n’est copié.
3. Lancer `windows\Install-Studio.ps1 -TargetUser Guest_`. Le script installe les dépendances, configure Git, crée le raccourci avec icône et la tâche `CodeAlkhayratStudio`, et autorise seulement les ports du studio depuis le sous-réseau local dans le pare-feu.
4. Ouvrir « Code Alkhayrat Studio » sur le bureau. Le raccourci vérifie le serveur puis ouvre une fenêtre dédiée Chrome/Edge. La tâche démarre au démarrage/à l’ouverture de session si Windows permet S4U, sinon à l’ouverture de session ; elle redémarre après une panne. Les journaux sont dans `.studio/logs/server.log`.

Pour révoquer la publication de ce PC, supprimer sa clé dans les Deploy keys du dépôt. Pour mettre à jour un studio ayant déjà du contenu local, sauvegarder d’abord la base et les nouveaux médias, puis résoudre les différences Git sans réinitialisation forcée.

## Vérifications de la refonte

Avec le serveur local démarré et Playwright installé, lancer `node tests/design-qa.mjs`.

Les écritures de l’administration (création, enregistrement, import, suppression et publication) sont interceptées et simulées en mémoire. Les tests ne modifient ni la base réelle ni GitHub. Les captures sont créées dans un dossier temporaire indiqué à la fin du test.

Options : `QA_ORIGIN` pour l’URL locale, `QA_FILTER` pour sélectionner des scénarios, `QA_PLAYWRIGHT_MODULE` et `QA_CHROMIUM_PATH` pour utiliser une installation existante de Playwright et Chromium.

`npm test` vérifie le serveur, les protections réseau, les transferts et la publication contre des dépôts temporaires. `node tests/phone-qa.mjs` vérifie le vrai parcours PC/téléphone avec microphone simulé dans une base temporaire, sans toucher à la base réelle ni à GitHub.
