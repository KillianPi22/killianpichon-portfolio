/**
 * Traduction francaise du portfolio.
 *
 * L'anglais reste la source unique : il vit dans index.html et
 * data/projects.js, et il s'edite normalement. Ce fichier est une couche
 * posee par-dessus. Une entree absente retombe sur l'anglais, donc le site
 * ne casse jamais, meme a moitie traduit.
 *
 * ui        La cle est la phrase anglaise elle-meme, exactement telle qu'elle
 *           est ecrite dans le code. Pas de cle inventee a maintenir en
 *           parallele : le jour ou l'anglais change, la correspondance se
 *           voit tout de suite au lieu de pourrir en silence.
 *
 * uiSection Pour le cas rare ou la meme phrase anglaise doit se traduire
 *           differemment selon l'endroit. La cle s'ecrit "Composant::phrase"
 *           et ne s'applique qu'aux appels qui nomment leur section
 *           explicitement. Vide tant qu'aucun conflit ne se presente.
 *
 * projects  Surcharges des fiches, par identifiant de projet puis par champ.
 *           Memes noms de champs que data/projects.js. Un champ absent garde
 *           l'anglais, ce qui permet de traduire une fiche par morceaux.
 *
 * head      Titres et descriptions de page, par ecran. Memes cles que
 *           SCREEN_META dans index.html.
 *
 * stale     Phrases dont l'anglais a change depuis la traduction. L'editeur
 *           y inscrit la cle au lieu de jeter le francais devenu orphelin.
 *           A relire, puis a retirer d'ici.
 *
 * Les reperes {…} d'une phrase se remplacent apres traduction : le francais
 * peut donc les remettre dans un autre ordre que l'anglais.
 *
 * NE SE TRADUISENT PAS, volontairement : les noms de logiciels, de studios,
 * de clients, de festivals, de prix, ainsi que les titres d'oeuvres. Ce sont
 * des noms propres ; les traduire rendrait le portfolio impossible a recouper
 * avec les credits publies ailleurs.
 *
 * Typographie : le   qui precede : ; ! ? est une espace fine insecable.
 * Elle est invisible a l'edition, d'ou l'echappement plutot que le caractere.
 * Les accents, eux, s'ecrivent normalement.
 */
window.KP_FR = {
  ui: {
    /* ------------------------------------------------------- navigation */
    'Work': 'Projets',
    'About': 'Profil',
    'Technical': 'Technique',
    'Contact': 'Contact',
    'Primary navigation': 'Navigation principale',
    'Killian Pichon — Work': 'Killian Pichon — Projets',
    'Language': 'Langue',
    'English': 'Anglais',
    'Privacy': 'Confidentialité',
    'Privacy choices': 'Choix de confidentialité',
    '© 2026 · All rights reserved': '© 2026 · Tous droits réservés',

    /* Banniere de consentement (assets/analytics-consent.js). L'espace finale
       de la phrase fait partie de la cle : le lien la suit directement.
       Ces six traductions existent aussi dans privacy.html, qui affiche la
       meme banniere sans charger ce fichier. Si l'une change, changer l'autre. */
    'Optional analytics': 'Statistiques facultatives',
    'Close privacy choices': 'Fermer les choix de confidentialité',
    'Google Analytics helps measure visits and improve this portfolio. It stays completely unloaded unless you allow it. ':
      'Google Analytics sert à mesurer les visites et à améliorer ce portfolio. Il reste entièrement inactif tant que tu ne l’autorises pas. ',
    'Privacy details': 'Détails de confidentialité',
    'Decline': 'Refuser',
    'Allow analytics': 'Autoriser les statistiques',

    /* ----------------------------------------------------------- accueil */
    'Immersive Artist': 'Artiste immersif',
    '3D Artist Generalist / Real-Time': 'Généraliste 3D / Temps réel',
    'Technical Art & Visual Storytelling': 'Direction technique et narration visuelle',
    'Realtime Graphics · Technical Art · Immersive': 'Temps réel · Direction technique · Immersif',
    'Showreel': 'Démo',
    'Showreel · 2026': 'Démo · 2026',
    'Open showreel': 'Ouvrir la démo',
    'Scroll to Explore': 'Faire défiler',
    'Coming Soon': 'À venir',
    'The showreel is currently in production. Check back soon.': 'La démo est en cours de montage. Reviens bientôt.',
    'Invalid reel URL': 'Adresse de démo invalide',
    'Close': 'Fermer',

    'Featured Projects': 'Projets en vedette',
    'CLICK HERE FOR MORE PROJECTS': 'VOIR TOUS LES PROJETS',
    'Hide Projects': 'Masquer les projets',
    'Reduce the list': 'Réduire la liste',
    'Show all ({n})': 'Tout afficher ({n})',
    'Selected Clients & Collaborators': 'Clients et collaborateurs',
    'Previous clients': 'Clients précédents',
    'Next clients': 'Clients suivants',
    'Awards & Recognition': 'Prix et reconnaissances',
    'Official Selection': 'Sélection officielle',
    'Official Nominee': 'Finaliste',
    'Public Award': 'Prix du public',
    'Winner': 'Lauréat',
    'Prix NUMIX 2026 — International Exhibition': 'Prix NUMIX 2026 — International · Exposition',

    /* ------------------------------------------------------------ profil */
    'Core Expertise': 'Compétences principales',
    'Specializations': 'Spécialisations',
    'Technical Toolkit': 'Outils',
    'Work Experience': 'Expérience',
    'Education': 'Formation',
    'Download CV': 'Télécharger le CV',

    'Camera & Motion': 'Caméra et mouvement',
    'Cross-disciplinary Collaboration': 'Collaboration pluridisciplinaire',
    'Fulldome Compositing': 'Compositing fulldôme',
    'Immersive Experience Production': 'Production d’expériences immersives',
    'Production Workflow Design': 'Conception de flux de production',
    'Projection Mapping Design': 'Conception de mapping vidéo',
    'R&D & Previsualization': 'R-D et prévisualisation',
    'Realtime Rendering': 'Rendu temps réel',
    'Technical Art': 'Direction technique',
    'Visual Storytelling': 'Narration visuelle',

    'Electronic Music & AV Performance': 'Musique électronique et performance audiovisuelle',
    'Fulldome Cinema': 'Cinéma fulldôme',
    'Immersive Experiences': 'Expériences immersives',
    'Immersive Storytelling': 'Narration immersive',
    'Projection Mapping': 'Mapping vidéo',
    'Realtime Visual Systems': 'Systèmes visuels temps réel',
    'Virtual Production': 'Production virtuelle',

    'Realtime & Game Engines': 'Temps réel et moteurs de jeu',
    '3D & Look Development': '3D et look development',
    'Compositing & Motion': 'Compositing et animation',
    'Custom Shaders': 'Shaders sur mesure',
    'Unity (basic)': 'Unity (notions)',

    'English (professional)': 'Anglais (professionnel)',
    'French (native)': 'Français (langue maternelle)',
    'German (elementary)': 'Allemand (notions)',

    'I create immersive experiences through real-time graphics, technical art and visual storytelling. Based in Montréal, I work between image-making and production thinking, shaping visuals while helping teams iterate, review and deliver complex spatial work.':
      'Je crée des expériences immersives par le graphisme temps réel, la direction technique et la narration visuelle. Basé à Montréal, je travaille entre la fabrication d’images et la réflexion de production, en façonnant les visuels tout en aidant les équipes à itérer, à juger et à livrer des projets spatiaux complexes.',

    /* Experience : intitules de poste, lieux, resumes */
    'Co-founded an independent collective dedicated to immersive cinema and real-time storytelling. I guide camera, look development, visual effects and technical decisions from early studies through fulldome delivery, keeping creative choices connected to how an audience experiences the work inside the dome.':
      'Cofondation d’un collectif indépendant consacré au cinéma immersif et à la narration temps réel. J’oriente la caméra, le look development, les effets visuels et les décisions techniques, des premières études jusqu’à la livraison fulldôme, en gardant les choix créatifs liés à la façon dont le public vit l’oeuvre sous le dôme.',
    'Realtime 3D Generalist / Motion Designer': 'Généraliste 3D temps réel / Motion designer',
    '3D Generalist / Motion Designer': 'Généraliste 3D / Motion designer',
    'Co-founder / Realtime Artist': 'Cofondateur / Artiste temps réel',
    /* Les lieux (Montréal, QC — Laval, France) s'ecrivent pareil dans les deux
       langues : pas d'entree, le repli les conserve. */
    '2024 — Present': '2024 — aujourd’hui',
    '2023 — Present': '2023 — aujourd’hui',
    'Freelance — Montréal, QC': 'À mon compte — Montréal, QC',

    'Develop immersive visuals, cinematic environments and interactive content for entertainment, cultural and live-event productions. The work combines image-making with practical production decisions: clarifying handoffs, protecting iteration time and adapting content to the display system where it will be experienced.':
      'Création de visuels immersifs, d’environnements cinématographiques et de contenus interactifs pour des productions de divertissement, culturelles et événementielles. Le travail mêle la fabrication d’images à des décisions de production concrètes : clarifier les transferts entre équipes, préserver le temps d’itération et adapter le contenu au dispositif où il sera vu.',

    'Contributed to immersive installations, traveling shows and fulldome productions alongside artists, designers and developers. My work focused on animation systems, projection-scale look development, compositing handoffs and preview studies that helped teams review spatial content earlier in production.':
      'Contribution à des installations immersives, des spectacles itinérants et des productions fulldôme, aux côtés d’artistes, de designers et de développeurs. Mon travail portait sur les systèmes d’animation, le look development à l’échelle de la projection, les transferts vers le compositing et les études de prévisualisation qui ont permis aux équipes de juger le contenu spatial plus tôt en production.',

    'Contributed to projection mapping, museum installations and live-event productions for international clients. The work required adapting animation, compositing and visual effects to architectural surfaces, public viewing distances and the shared delivery needs of multidisciplinary teams.':
      'Contribution à des projets de mapping vidéo, des installations muséales et des productions événementielles pour des clients internationaux. Il fallait adapter l’animation, le compositing et les effets visuels aux surfaces architecturales, aux distances de lecture du public et aux besoins de livraison partagés d’équipes pluridisciplinaires.',

    'Celestia — Developed scalable flock animation, a projection-readable visual treatment and separated compositing passes; also explored a PC/VR review workflow for artists, production and the client before installation.':
      'Celestia — Animation de nuées à grande échelle, traitement visuel lisible en projection et passes de compositing séparées ; exploration également d’un flux de revue PC/VR destiné aux artistes, à la production et au client avant l’installation.',

    'Hurtubise — Built reusable neon-animation systems and synchronized layered artwork with music for a fulldome presentation.':
      'Hurtubise — Systèmes réutilisables d’animation de néons et synchronisation des couches d’oeuvres avec la musique, pour une présentation fulldôme.',

    'Volcano — Winner, Prix NUMIX 2026 (International · Exhibition). Structured the cleaning, repair and integration of 16K geological textures for a large-format immersive environment.':
      'Volcano — Lauréat du Prix NUMIX 2026 (International · Exposition). Organisation du nettoyage, de la réparation et de l’intégration de textures géologiques 16K pour un environnement immersif grand format.',

    /* Cle entre guillemets doubles : la source porte une apostrophe droite,
       et une cle doit reproduire l'anglais au caractere pres. */
    "Traveler's Introspection — Public Award, SATFest 2026. Official Selection: Dome Under Film Festival, PFCAT, Macon Film Festival, FDUK.":
      'Traveler\'s Introspection — Prix du public, SATFest 2026. Sélection officielle : Dome Under Film Festival, PFCAT, Macon Film Festival, FDUK.',

    'Clients & Projects: Melanie Martinez Tour (Normal Studio), XYZ Technologies, Lumin-Art, Transversal.':
      'Clients et projets : tournée de Melanie Martinez (Normal Studio), XYZ Technologies, Lumin-Art, Transversal.',

    'Sangue e Arena — Permanent projection mapping experience, Colosseum, Rome.':
      'Sangue e Arena — Mapping vidéo permanent, Colisée, Rome.',

    'Le Banquet — Immersive multi-sensory projection mapping experience, Cité des Sciences, Paris.':
      'Le Banquet — Expérience multisensorielle de mapping vidéo, Cité des Sciences, Paris.',

    'Habits de Lumière – 1858 — Architectural projection mapping, Épernay.':
      'Habits de Lumière – 1858 — Mapping architectural, Épernay.',

    'IHF World Handball Championship Opening Ceremony — Large-scale live event visuals, Cairo.':
      'Cérémonie d’ouverture du Championnat du monde de handball IHF — Visuels événementiels grand format, Le Caire.',

    /* Formation */
    'Unreal Engine Intensive Program': 'Programme intensif Unreal Engine',
    'Intensive specialization in Unreal Engine covering modern CG pipelines, virtual production, procedural world building and collaborative workflows.':
      'Spécialisation intensive en Unreal Engine : pipelines CG modernes, production virtuelle, construction procédurale de mondes et travail collaboratif.',
    'Real-time 3D production for interactive media and video games — 3D content creation, game engine integration, optimization, modeling, animation, level design and visual scripting.':
      'Production 3D temps réel pour les médias interactifs et le jeu vidéo — création de contenu 3D, intégration moteur, optimisation, modélisation, animation, level design et scripting visuel.',
    'Bachelor\'s Degree in Real-Time 3D': 'Licence en 3D temps réel',
    'Baccalauréat in Applied Arts': 'Baccalauréat en arts appliqués',
    'Multidisciplinary art and design curriculum — composition, drawing, color theory and design thinking.':
      'Formation pluridisciplinaire en art et design — composition, dessin, théorie de la couleur et démarche de conception.',

    /* --------------------------------------------------------- technique */
    'Production Thinking': 'Démarche de production',
    'Working Philosophy': 'Façon de travailler',
    '01 — Areas of Interest': '01 — Centres d’intérêt',
    '02 — Production Studies': '02 — Études de production',
    'Cross-System Synchronization': 'Synchronisation entre systèmes',
    'I enjoy understanding how productions are built as much as creating the visuals themselves. My technical work focuses on reducing iteration time, improving creative handoffs and helping teams review immersive experiences earlier during production.':
      'Comprendre comment une production se construit m’intéresse autant que fabriquer les images. Mon travail technique cherche à réduire le temps d’itération, à améliorer les transferts entre les équipes et à permettre de juger une expérience immersive plus tôt en production.',
    'My areas of interest sit where visual decisions meet production constraints: pipeline development, real-time rendering, production optimization, immersive projection, virtual production and R&D. Unreal Engine, Niagara and compositing tools are useful when they shorten feedback loops, clarify spatial decisions or make a workflow more dependable — never as outcomes by themselves.':
      'Mes centres d’intérêt se situent là où les décisions visuelles rencontrent les contraintes de production : développement de pipeline, rendu temps réel, optimisation, projection immersive, production virtuelle et R-D. Unreal Engine, Niagara et les outils de compositing sont utiles quand ils raccourcissent les boucles de retour, clarifient une décision spatiale ou rendent un flux plus fiable — jamais comme une fin en soi.',
    'Technical studies begin with a production question: how can a client review scale before installation, how can a team revise timing without rebuilding a scene, or how can ultra-high-resolution assets remain practical to handle? I test workflows against those questions, document what changes the process and keep the solution proportional to the production.':
      'Une étude technique part d’une question de production : comment un client peut-il juger de l’échelle avant l’installation, comment une équipe peut-elle revoir le rythme sans reconstruire une scène, ou comment des ressources en très haute résolution peuvent-elles rester maniables ? Je confronte les flux de travail à ces questions, je documente ce qui change le processus et je garde la solution proportionnée à la production.',
    'Immersive Production Systems': 'Systèmes de production immersive',
    'Pipeline Development': 'Développement de pipeline',
    'Production Optimization': 'Optimisation de production',
    'Previsualization': 'Prévisualisation',
    'Compositing Strategy': 'Stratégie de compositing',
    'Camera & Timing': 'Caméra et rythme',
    'Immersive Projection': 'Projection immersive',
    'Iteration Time': 'Temps d’itération',
    'R&D': 'R-D',

    /* ----------------------------------------------------------- contact */
    'Get In Touch': 'Écrire',
    'Reach out for general questions, hiring opportunities, or a studio collaboration proposal using the form — no other contact details are published on this site.':
      'Utilise le formulaire pour une question, une offre d’emploi ou une proposition de collaboration — aucune autre coordonnée n’est publiée sur ce site.',
    'Name': 'Nom',
    'Your name': 'Ton nom',
    'Email': 'Courriel',
    'Subject': 'Objet',
    'Message': 'Message',
    'Tell me about your project…': 'Parle-moi de ton projet…',
    'General Inquiry': 'Question générale',
    'Hiring Opportunity': 'Offre d’emploi',
    'Studio Collaboration Proposal': 'Proposition de collaboration',
    'Send Message': 'Envoyer',
    'Sending…': 'Envoi…',
    'Sent — Resend in {n}s': 'Envoyé — renvoi dans {n} s',
    'Try Again': 'Réessayer',
    'Failed — Try Again': 'Échec — réessayer',
    'Sent directly — no email client required. Limited to one message per {n}s.':
      'Envoi direct, sans client de messagerie. Limité à un message toutes les {n} s.',
    'Too many attempts. Try again in {n} seconds.': 'Trop de tentatives. Réessaie dans {n} secondes.',

    /* ------------------------------------------------------ fiche projet */
    /* Deux ecritures coexistent dans le code : le lien de retour porte le
       chevron et des capitales, l'etiquette de la fiche protegee non. */
    'All projects': 'Tous les projets',
    '‹ All Projects': '‹ Tous les projets',
    'Overview': 'Présentation',
    'Role': 'Rôle',
    'Tools': 'Outils',
    'My Contribution': 'Ma contribution',
    'Technical Challenges': 'Défis techniques',
    'Design Intent': 'Intention',
    'Watch on YouTube': 'Voir sur YouTube',
    'Watch full film': 'Voir le film complet',
    'Research & Development': 'Recherche et développement',
    'Pipeline': 'Pipeline',
    'Project Impact': 'Résultat',
    'Recognition': 'Reconnaissance',
    'Project Credits': 'Crédits',
    'Related Projects': 'Projets liés',
    'Preview': 'Aperçu',
    'See more': 'Voir plus',
    'Prev Project': 'Projet précédent',
    'Next Project': 'Projet suivant',
    'Previous project': 'Projet précédent',
    'Next project': 'Projet suivant',
    'Previous image': 'Image précédente',
    'Next image': 'Image suivante',
    'Project still': 'Image du projet',

    /* --------------------------------------------------- contenu protege */
    'Protected project': 'Projet protégé',
    'Access code required': 'Code d’accès requis',
    'Access code': 'Code d’accès',
    'This project is covered by a confidentiality agreement. Enter the access code to open it.':
      'Ce projet est couvert par une entente de confidentialité. Saisis le code d’accès pour l’ouvrir.',
    'Incorrect access code.': 'Code d’accès incorrect.',
    'Access code not recognized.': 'Code d’accès non reconnu.',
    'Secure access is unavailable in this browser.': 'L’accès sécurisé n’est pas disponible dans ce navigateur.',
    'This protected link is not configured correctly.': 'Ce lien protégé n’est pas configuré correctement.',
    'Too many attempts. Try again in {n}s.': 'Trop de tentatives. Réessaie dans {n} s.',
    'Wait {n}s': 'Patiente {n} s',
    'Open protected content': 'Ouvrir le contenu protégé',
    'Close protected access': 'Fermer l’accès protégé',
    'Restricted preview': 'Aperçu restreint',
    'Full film access': 'Accès au film complet',
    'Enter the access code provided to you. The film link is revealed only after verification on this device.':
      'Saisis le code d’accès qui t’a été transmis. Le lien du film n’apparaît qu’après vérification, sur cet appareil.',
    'Checking…': 'Vérification…',
    'Unlock film': 'Déverrouiller le film',
    'Access granted': 'Accès accordé',
    'The film link is ready to open or copy into another browser.': 'Le lien du film est prêt à ouvrir ou à copier dans un autre navigateur.',
    'Unlocked film link': 'Lien du film déverrouillé',
    '{provider} link': 'Lien {provider}',
    'Copy link': 'Copier le lien',
    'Link copied.': 'Lien copié.',
    'Copy failed. Select the link and copy it manually.': 'La copie a échoué. Sélectionne le lien et copie-le à la main.',
    'Open film ↗': 'Ouvrir le film ↗',
    'Please do not redistribute this restricted preview link.': 'Merci de ne pas rediffuser ce lien d’aperçu restreint.',

    /* --------------------------- libelles pour lecteurs d'ecran --------- */
    /* Le repere {title} porte le nom du projet, qui ne se traduit pas :
       seule la phrase autour change. */
    'Gallery still {n}': 'Image {n} de la galerie',
    'Play {title} video': 'Lire la vidéo de {title}',
    'Open {title} image {n}': 'Ouvrir l’image {n} de {title}',
    '{title} video': 'Vidéo de {title}',
    '{title} image preview': 'Aperçu d’image de {title}',
    '{title} project image {n} of {total}': 'Projet {title}, image {n} sur {total}'
  },

  uiSection: {},

  /* Les titres, studios, clients et listes d'outils ne figurent pas ici : ce
     sont des noms propres, et le repli sur l'anglais les conserve tels quels.
     Un champ absent garde l'anglais, donc une fiche peut se traduire par
     morceaux sans jamais casser l'affichage. */
  projects: {
    celestia: {
      category: 'Expérience immersive sur site',
      venue: 'Denver et Chicago',
      desc: 'Une production immersive itinérante construite autour d’une question concrète : comment un spectacle monumental peut-il rester dirigeable artistiquement dans deux salles, sans reconstruire son flux de travail ?',
      overview: 'Produite chez Normal Studio, Celestia a été créée à Denver avant d’être remontée à Chicago. La production demandait de grandes nuées capables de se lire clairement sur une surface de projection monumentale, formant un langage visuel féerique qui tienne à cette échelle. Le système devait aussi rester assez souple pour accepter des décisions créatives tardives et se transposer d’une installation à l’autre.',
      role: 'Généraliste 3D temps réel — animation procédurale, look development et compositing',
      contribution: ['Conception des comportements de nuées procédurales et du mélange d’animations pour les groupes d’arrière-plan, en gardant les oiseaux principaux à part pour les gros plans qui demandaient un jeu dirigé.', 'Développement, avec la direction artistique, d’un traitement visuel simplifié mené par le Fresnel, pour que les silhouettes et le mouvement restent lisibles sur la surface de projection.', 'Préparation de passes séparées de lumière, de masque et de base, afin que les ajustements finaux se fassent au compositing sans rouvrir chaque élément rendu.'],
      technicalChallenges: ['Le défi — les grandes surfaces de projection effacent le détail fin, et une approche de rendu littérale aurait rendu les changements visuels tardifs plus lents et plus difficiles à maîtriser.', 'La réponse de production — le look a été organisé autour de formes lisibles, de passes séparées et de tests de compositing précoces ; les nuées procédurales ont absorbé l’échelle pendant que l’animation principale préservait les moments écrits.', 'L’effet sur la production — l’équipe a pu affiner le rythme et finir plus tard dans le processus, et la même logique de production a suivi de l’installation de Denver au remontage de Chicago.'],
      rnd: ['Avant que le flux VR ne soit relié au système de visualisation PC existant, j’ai livré une première version VR jouable pour que les artistes, la production et le client puissent déjà juger l’expérience dans l’espace. Un second technical artist a ensuite mené une passe d’optimisation et fusionné les deux systèmes.', 'Les tests de lecture ont porté sur l’expérience du spectateur : préserver la clarté et l’impact visuel à l’échelle monumentale tout en restant dans les limites du temps réel. Nous avons comparé dimensions d’image, résolution, comportement du lecteur et encodage, puis choisi Bink pour une lecture haute résolution plus fiable.', 'Le flux d’aperçu des artistes a été ajusté sur les mêmes contraintes, ce qui leur permettait de juger des images proches du spectacle final sans maintenir une version basse fidélité en parallèle.', 'Cette approche par étapes a permis de décider plus tôt de la mise en scène, de l’échelle et du rythme, avec moins de dépendance aux exports rendus ou aux retours du jour de l’installation.'],
      pipeline: ['Blocking des nuées procédurales et animation principale', 'Look development à l’échelle de la projection', 'Préparation des passes de rendu séparées', 'Revue de compositing temps réel', 'Recherche PC/VR avant installation'],
      impact: 'Le flux de travail obtenu a gardé les décisions visuelles modifiables jusqu’au compositing, et s’est adapté au passage de la production de Denver à Chicago.'
    },

    hurtubise: {
      category: 'Film immersif · Fulldôme',
      venue: 'Planétarium de Montréal',
      desc: 'Une production fulldôme qui traduit les tableaux de Jacques Hurtubise en lumière, mouvement et composition spatiale synchronisés.',
      overview: 'Présenté au Planétarium de Montréal, le film place l’oeuvre de Jacques Hurtubise dans une expérience audiovisuelle à l’échelle du dôme, sur une musique d’Hippie Hourrah. Le défi de production : animer les tableaux sans perdre leur rythme graphique, puis coordonner plusieurs couches visuelles sur une surface immersive continue.',
      role: 'Artiste 3D temps réel — systèmes d’animation, synchronisation et compositing fulldôme',
      contribution: ['Développement de rigs d’animation réutilisables pour les séquences de néons, afin de diriger de grands groupes d’ampoules sans perdre l’énergie irrégulière de l’oeuvre d’origine.', 'Préparation et animation des séquences de fenêtres mappées et des interprétations numériques des tableaux d’Hurtubise.', 'Compositing du matériel fulldôme, incluant les traitements de retard visuel et les ajustements de rythme nécessaires à la synchronisation sur le dôme.', 'Décisions de mouvement et de rythme travaillées avec le compositeur Tommy Caron, pour que l’animation soutienne la musique sans devenir mécaniquement répétitive.'],
      technicalChallenges: ['Le défi — des centaines de lumières animées et d’oeuvres superposées devaient paraître coordonnées sur le dôme, tout en préservant la tension et la spontanéité du langage visuel d’Hurtubise.', 'La réponse de production — des rigs réutilisables ont organisé l’animation des lumières, pendant que les séquences mappées et le compositing par retard étaient réglés comme des couches liées plutôt que comme des plans isolés.', 'L’effet sur la production — le système a permis d’itérer sur le rythme et la synchronisation sans reconstruire chaque élément un par un.'],
      rnd: ['Les études de caméra et de rythme se sont développées par échanges répétés avec le compositeur Tommy Caron, à la recherche de règles de minutage qui soutiennent la partition tout en laissant place à la variation.'],
      pipeline: ['Préparation des oeuvres et animation mappée', 'Rigging réutilisable des néons', 'Études de rythme menées par la musique', 'Compositing fulldôme', 'Synchronisation et intégration technique sur le dôme'],
      impact: 'La production relie peinture, lumière et musique par une structure de minutage commune, conçue pour les exigences spatiales de la projection fulldôme.'
    },

    volcano: {
      category: 'Installation immersive · 270°',
      cardCategory: 'Installation immersive',
      venue: 'Musée Perlan, Reykjavík',
      desc: 'Une expérience muséale à 270° qui combine des images de volcans et des paysages numériques préparés pour une vision rapprochée, en grand format.',
      overview: 'Créée pour le planétarium sur mesure du Perlan à Reykjavík, l’installation est une descente permanente, projetée tous les jours, sous la péninsule de Snæfellsnes : des images documentaires d’éruptions vers des environnements volcaniques reconstruits. L’image court sur une surface LED continue qui enveloppe le public à 270° verticalement et 360° horizontalement, prolongée par un plancher de verre, si bien que la roche se lit de près plutôt qu’à distance cadrée. Ces environnements ont été rebâtis en partie par photogrammétrie de roches et de falaises islandaises. Ma contribution a porté sur le fait de rendre ces ressources géologiques en très haute résolution utilisables en production, sans perdre le détail de surface que la distance de vision expose.',
      role: 'Environment artist — look development et intégration de ressources haute résolution',
      contribution: ['Évaluation et préparation de ressources géologiques portant des textures sources en 16K.', 'Nettoyage et réparation des zones de texture qui deviendraient visibles à l’échelle de l’installation.', 'Intégration des ressources dans l’environnement temps réel, en équilibrant la fidélité et les performances de production.', 'Documentation d’un transfert reproductible entre réparation de texture, look development et intégration finale de la scène.'],
      technicalChallenges: ['Le défi — les textures 16K portaient le détail géologique exigé par l’expérience, mais leur poids rendait l’inspection, la réparation et l’itération difficiles.', 'La réponse de production — les textures ont été découpées en étapes délibérées de réparation et de validation, de sorte que seules les zones affectant l’image finale reçoivent un travail intensif.', 'L’effet sur la production — les ressources haute résolution ont pu traverser le look development et l’intégration sans traiter chaque fichier source comme une opération également coûteuse.'],
      recognition: ['Prix NUMIX 2026 — Lauréat, International · Exposition'],
      pipeline: ['Évaluation des textures sources 16K', 'Nettoyage et réparation ciblés', 'Intégration des ressources haute résolution', 'Revue de look development', 'Préparation de scène attentive aux performances'],
      impact: 'Le flux de travail a préservé le détail géologique nécessaire à la présentation à 270°, tout en rendant les ressources maniables à juger et à intégrer pendant la production.',
      creditsNote: 'Réalisation : Tommy Caron — Normal Studio',
      externalLabel: 'Voir plus sur Normal Studio'
    },

    melanie: {
      category: 'Visuels de tournée',
      venue: 'The Trilogy Tour — univers K-12 et Portals',
      desc: 'Des visuels de tournée qui traduisent les univers de livre d’images de Melanie Martinez en scènes conçues pour une lecture répétable en grande salle.',
      overview: 'Produit avec Normal Studio pour la Trilogy Tour, le travail traverse des environnements de terrain de jeu, de carrousel, de maison de poupée et de théâtre de marionnettes. Chaque scène devait préserver une direction artistique faite main tout en restant fiable dans le rythme et les contraintes techniques d’un spectacle en tournée.',
      role: 'Généraliste 3D temps réel',
      contribution: ['Modélisation de la boîte en bois et développement des chevaux de carrousel : modélisation, sculpture et travail des matières.', 'Adaptation de la balançoire à bascule et assemblage des environnements pour la lecture en direct.', 'Maintien de la continuité visuelle dans le passage d’un décor de livre d’images à l’autre.', 'Préparation et optimisation des scènes pour la répétabilité qu’exige une production en tournée.'],
      technicalChallenges: ['Le défi — les scènes devaient préserver une identité visuelle détaillée et artisanale tout en se lisant de façon constante sur un système de tournée en direct.', 'La réponse de production — les ressources ont été évaluées dans le contexte de chaque scène, et les simulations répétées de lancer d’objets ont été remplacées par une logique réutilisable dans la scène, ajustable sans nouvelle passe de simulation externe.', 'L’effet sur la production — les changements de mouvement et de mise en place ont pu être jugés directement dans la scène en direct, réduisant les allers-retours pendant l’itération.'],
      pipeline: ['Modélisation et adaptation des ressources', 'Développement des matières et des environnements', 'Assemblage de scène et revue de continuité', 'Logique de mouvement réutilisable', 'Préparation pour la lecture en tournée'],
      impact: 'Les scènes ont été préparées comme des éléments fiables d’une séquence de tournée plus large, avec des décisions visuelles prises par rapport au rythme du spectacle plutôt qu’à un seul plan rendu.'
    },

    traveler: {
      category: 'Film immersif · Dôme',
      cardCategory: 'Film immersif',
      roleTitle: 'Cofondateur',
      desc: 'Cocréation d’un film fulldôme original qui explore comment les mouvements de caméra, le rythme et l’échelle façonnent le récit et un mouvement qui paraît naturel dans un format à 360°.',
      overview: 'Un court métrage développé au sein de notre collectif Fantastik Obsolete. Un exercice de rythme de caméra, d’effets spéciaux et de narration singulière. L’histoire suit le Voyageur à travers un cycle de vie déployé sur plusieurs scènes.',
      role: 'Cofondateur — caméra, effets visuels, compositing et technique',
      contribution: ['J’ai produit les scènes de la Chute d’or et du Miroir des ombres, ainsi que la scène finale avec Nicolas Lachance-Brais pour la modélisation et le mouvement de l’oeuf.', 'Développement d’études d’effets visuels dans Niagara, exploration des modules de motion design et des cloners récemment implantés.'],
      technicalChallenges: ['Le problème : regarder nos propres scènes sur un écran 16:9, avec nos habitudes de spectateurs.', 'La solution de production : chaque séquence a été revue en réalité virtuelle, de façon itérative, pour évaluer le confort, l’accélération, la décélération et la fluidité des mouvements spatiaux.', 'L’effet sur la production : les décisions de caméra et de rythme ont été validées avant le rendu final pour le dôme, ce qui a permis aux révisions de porter sur la perception du public plutôt que sur des rigidités techniques. Entre rigueur métrique et raccourcis pour boucler la recette visuelle.'],
      rnd: ['La revue en réalité virtuelle a servi d’étude de production tout au long du film : elle permettait d’évaluer le mouvement et l’échelle de l’intérieur, plutôt que de s’en remettre à un aperçu figé.', 'Ce processus a donné une base commune pour parler de confort, de rythme et d’immersion avant la présentation finale sous le dôme.'],
      recognition: ['SAT Fest 2026 — Prix du public', 'SAT Fest 2026 — Sélection officielle', 'FDUK 2026 — Sélection officielle', 'Dome Under Film Festival 2026 — Sélection officielle', 'Macon Film Festival 2026 — Sélection officielle', 'Portland Festival of Cinema, Animation & Technology 2026 — Nomination'],
      pipeline: ['Mise en place et mouvement de caméra', 'Vérification en réalité virtuelle, du point de vue du public', 'Améliorations du mouvement', 'Développement des effets visuels', 'Compositing entre After Effects et les logiciels 3D', 'Défis techniques de l’effet de balayage et du liquide autour de la planète', 'Performances, pour rendre sans faire tomber la carte graphique (VRAM maximale utilisée)'],
      impact: 'Le projet nous a permis d’élargir notre potentiel créatif et de consolider notre structure comme notre image de marque.'
    },

    paralleles: {
      category: 'Installation interactive · Temps réel',
      desc: 'Une installation interactive bâtie sur une chaîne caméra-présentation synchronisée, qui relie des séquences cinématographiques à des visuels procéduraux. Réalisée en 28 heures.',
      overview: 'Développé avec Transversal, PARALLÈLES demandait que deux systèmes visuels se comportent comme une seule ligne de temps de production. Les séquences de caméra cinématographique menaient la présentation, des messages OSC déclenchaient les événements procéduraux dans TouchDesigner, et les images obtenues revenaient dans la scène temps réel pour la capture et la revue.',
      role: 'Artiste temps réel — caméra, séquençage et intégration technique',
      contribution: ['Conception du langage de caméra et animation des séquences cinématographiques servant à présenter l’installation.', 'Structuration de la ligne de temps maîtresse et raccordement de ses repères aux événements visuels procéduraux par OSC.', 'Intégration du retour visuel dans la scène, pour une capture et un compositing synchronisés.', 'Préparation des séquences de présentation utilisées lors de la validation du projet.'],
      technicalChallenges: ['Le défi — mouvement de caméra, images procédurales et rythme de présentation vivaient dans des systèmes distincts, mais devaient rester synchronisés pendant la revue.', 'La réponse de production — la ligne de temps cinématographique a servi d’horloge maîtresse, envoyant les repères OSC vers l’extérieur et recevant en retour les images générées dans la scène de présentation.', 'L’effet sur la production — l’équipe a pu juger le travail de caméra et les visuels procéduraux comme une seule séquence cohérente, au lieu de valider chaque système séparément.'],
      pipeline: ['Conception de caméra et animation cinématographique', 'Séquençage de la ligne de temps maîtresse', 'Échange de repères OSC', 'Génération des visuels procéduraux', 'Capture de retour et compositing temps réel', 'Validation de la présentation'],
      impact: 'Le flux connecté a transformé des processus visuels séparés en une séquence de présentation jugeable, dans la fenêtre de production de 28 heures du projet.'
    },

    batiscan: {
      category: 'Maquette interactive · Conception de mapping vidéo',
      cardCategory: 'Maquette interactive',
      roleTitle: 'À mon compte',
      desc: 'Conception de mapping vidéo pour une maquette interactive, qui aide les visiteurs à lire la géographie et le caractère saisonnier du parc avant d’entrer sur le site. Réalisée en 72 heures.',
      overview: 'Créée pour le Parc de la Rivière Batiscan avec XYZ Technologies, l’installation présente le site par une maquette interactive à l’accueil. J’ai produit l’ensemble du contenu visuel de la maquette physique, avant que la couche interactive ne soit intégrée par l’équipe élargie.',
      designIntent: 'L’objectif était de rendre le parc compréhensible d’un coup d’oeil, pas d’en reproduire chaque détail littéralement. Éclairage, ombrage, eau et transitions saisonnières ont été jugés à la clarté avec laquelle un visiteur pouvait lire le terrain depuis différentes positions autour de la maquette.',
      role: 'À mon compte — contenu visuel et conception de mapping vidéo',
      contribution: ['Création de l’ensemble de la conception de mapping vidéo pour la maquette physique.', 'Développement des contenus visuels d’été et d’hiver projetés sur le terrain.', 'Prise en charge du look development du terrain, du comportement de l’eau, de l’ombrage, de l’éclairage et des effets visuels.', 'Préparation du compositing final livré avant l’intégration de la couche interactive.'],
      contributionNote: 'Les fonctions interactives ont été développées ensuite, par d’autres, et ne relevaient pas de mes responsabilités.',
      technicalChallenges: ['Le défi — le contenu projeté devait s’aligner sur la géométrie physique de la maquette et rester lisible depuis plusieurs points de vue de visiteurs.', 'La réponse de production — précision de projection, contraste du terrain, transitions saisonnières, comportement de l’eau et éclairage ont été évalués ensemble, à l’aune de la lisibilité pour le public.', 'L’effet sur la production — le système visuel a donné aux visiteurs une vue d’ensemble claire du paysage et de ses saisons avant qu’ils ne commencent à explorer le parc.'],
      impact: 'Le contenu final est devenu la base visuelle de l’installation interactive, aidant les visiteurs à mieux comprendre les paysages et les transformations saisonnières du Parc de la Rivière Batiscan avant leur visite. L’ensemble de la production visuelle a été réalisé en 72 heures.',
      pipeline: ['Planification de la projection sur maquette physique', 'Look development du terrain et des saisons', 'Eau et mouvement de l’environnement', 'Revue de lisibilité sous plusieurs angles', 'Compositing final', 'Transfert pour l’intégration interactive'],
      creditsNote: 'Courtoisie et photographies : XYZ Technologies',
      externalLabel: 'Voir plus sur XYZ Technologies'
    },

    epernay: {
      category: 'Mapping vidéo · Architectural',
      client: 'Ville d’Épernay',
      venue: 'Épernay, France',
      desc: 'Une production de mapping architectural qui se sert de l’Hôtel de Ville lui-même pour porter le récit de son histoire et de sa reconstruction.',
      overview: 'Créé par Graphics eMotion pour Habits de Lumière 2022 à Épernay, le spectacle de 15 minutes suit l’histoire du bâtiment par la voix de l’architecte Victor Lenoir. Ma contribution a couvert plusieurs séquences mêlant éclairage, particules, compositing et motion design, à l’intérieur de la production plus large du studio.',
      role: 'Artiste mapping vidéo',
      contribution: ['Préparation des calages de mapping sur la géométrie de la façade.', 'Développement des scènes attribuées : éclairage, ombrage, particules et compositing.', 'Conception d’un mouvement à l’échelle et au rythme d’une lecture architecturale.', 'Intégration des séquences dans le cadre narratif et technique plus large du studio.'],
      contributionNote: 'J’ai contribué à plusieurs séquences de mapping du spectacle au sein de l’équipe de Graphics eMotion ; l’ensemble du spectacle — direction, narration, mise en scène et autres séquences — était une production de studio complète, pas un travail solo.',
      designIntent: 'La façade a été traitée comme une partie de la narration plutôt que comme un écran neutre. Composition et mouvement suivaient la structure du bâtiment, pour que les moments historiques et poétiques restent lisibles à la distance du public.',
      technicalChallenges: ['Le défi — chaque événement visuel devait s’aligner sur la façade tout en restant clair à grande distance de vision.', 'La réponse de production — les lignes de l’architecture ont guidé la composition, l’éclairage et le mouvement des particules, la précision de projection étant jugée en même temps que le rythme narratif.', 'L’effet sur la production — les séquences attribuées ont soutenu le récit historique sans détacher l’image du bâtiment qui la portait.'],
      pipeline: ['Préparation du mapping de façade', 'Développement des scènes narratives', 'Intégration de l’éclairage et des particules', 'Revue de lisibilité à distance', 'Compositing et intégration au spectacle'],
      impact: 'Le spectacle final s’est servi de la projection à grande échelle pour relier l’architecture de l’Hôtel de Ville à l’histoire racontée sur sa façade.',
      creditsNote: 'Employeur : Graphics eMotion — Événement : Habits de Lumière 2022 — Lieu : Épernay, France'
    },

    colosseum: {
      category: 'Mapping vidéo · Architectural',
      venue: 'Colisée de Rome',
      desc: 'L’une de mes premières productions internationales de grande échelle, mêlant captation, animation et projection architecturale au Colisée de Rome.',
      overview: 'Sangue e Arena a porté des combats de gladiateurs, des scènes mythologiques et une bataille navale sur le Colisée, par une combinaison de prises de vues réelles et d’images de synthèse menée à l’échelle du studio. Artiste en début de carrière sur une production internationale majeure, j’ai pris en charge des séquences définies tout en apprenant comment un travail spécialisé se coordonne à l’intérieur d’un système visuel bien plus grand.',
      designIntent: 'Chaque contribution devait soutenir le récit historique et rester cohérente avec le matériel produit par les autres départements. Le travail a été pensé comme une part d’une projection architecturale commune, pas comme une collection d’effets isolés.',
      role: 'Artiste mapping vidéo',
      contribution: ['Rotoscopie et compositing des gladiateurs filmés, pour leur intégration dans les scènes projetées.', 'Animation des statues de pierre et développement des séquences de construction filaire de l’architecture.', 'Création complète de la scène 3D de la Naumachie : personnages, cycles de marche animés à la main et travail de particules.', 'Intégration des scènes attribuées dans le flux de mapping et la direction artistique partagée.'],
      contributionNote: 'C’était ma première production internationale de mapping à grande échelle. J’étais responsable de toute la production 3D de la séquence de la Naumachie, tandis que son compositing était pris en charge séparément par d’autres membres de l’équipe.',
      technicalChallenges: ['Le défi — interprètes filmés, animation de personnages, particules et imagerie architecturale devaient se lire comme les parties d’une même production, malgré des disciplines d’origine différentes.', 'La réponse de production — les responsabilités ont été réparties dans l’équipe, chaque séquence étant jugée au regard de la direction visuelle commune et de la géométrie du monument.', 'L’effet sur la production — le processus a construit une expérience concrète des transferts, du compositing et de l’animation à grande échelle, au sein d’une production collaborative internationale.'],
      impact: 'Le projet a été une leçon formatrice : comment le métier individuel, des frontières de responsabilité claires et une collaboration étroite soutiennent une production plus grande que n’importe quelle séquence isolée.',
      pipeline: ['Préparation et compositing des prises de vues réelles', 'Animation des personnages et des statues', 'Production de la scène de la Naumachie', 'Particules et effets architecturaux', 'Revue entre départements', 'Intégration à la projection'],
      creditsNote: 'Employeur : Graphics eMotion — Lieu : Colisée de Rome'
    },

    luminart: {
      category: 'Logo animé · Motion design',
      cardCategory: 'Logo animé',
      roleTitle: 'À mon compte',
      desc: 'Un logo animé bâti sur une seule idée : traiter la marque comme une lentille, et la laisser réfracter les productions de l’entreprise au lieu de se placer devant elles.',
      overview: 'Lumin-ART Productions conçoit des éclairages de scène et d’événements. L’animation devait ouvrir leurs vidéos et tenir sur leur site comme sur leurs réseaux, donc se lire en quelques secondes et supporter d’être revue. La direction est née des échanges avec le client : plutôt que d’animer une marque graphique, la construire à partir de l’optique avec laquelle l’entreprise travaille tous les jours — les anneaux étagés d’une lentille de Fresnel, celle des phares et des projecteurs de scène.',
      role: 'Artiste 3D à mon compte — concept, look development, animation et compositing',
      contribution: ['Direction de la lentille de Fresnel élaborée avec le client, puis production menée seul, de la modélisation au compositing final.', 'Construction des éléments réfractifs — le coeur annelé, la colonne de verre et les panneaux courbes de la marque — et de l’éclairage qui leur donne leur forme.', 'Insertion d’images de productions Lumin-ART à l’intérieur du verre, pour que ce que la lentille réfracte soit le travail de l’entreprise elle-même.', 'Compositing de la séquence finale.'],
      designIntent: 'Lumin-ART travaille avec la lumière : le logo a donc été traité comme un objet optique plutôt que graphique. La lentille de Fresnel lui a donné ses anneaux concentriques et son coeur réfractif, et a fait du verre un endroit plausible où voir apparaître les images de l’entreprise.',
      technicalChallenges: ['Le défi — un verre réfractif parcouru de fractures coûte cher à échantillonner, et les images censées apparaître dedans devaient rester reconnaissables à travers cette réfraction. Poussé vers le réalisme, le verre tourne au bruit ; retenu pour la clarté, la marque perd la matière qui en fait une lentille.', 'La réponse de production — l’équilibre s’est trouvé dans le rendu interactif de Redshift, en passant de l’ombrage à l’éclairage et au compositing comme un seul réglage plutôt que trois passes distinctes.', 'L’effet sur la production — la marque reste lisible pendant que les images tenues dans le verre demeurent identifiables, ce qui est la raison d’être du logo : montrer le travail plutôt que le décrire.'],
      pipeline: ['Concept et travail de références avec le client', 'Modélisation des éléments de lentille et de la marque', 'Ombrage et éclairage du verre', 'Intégration des images de production dans les réfractions', 'Animation et caméra', 'Compositing et étalonnage final'],
      impact: 'L’animation ouvre les vidéos de Lumin-ART et se retrouve sur leur site comme sur leurs réseaux, en portant des images de leurs propres productions à l’intérieur de la marque.',
      creditsNote: 'Son : Nidesco',
      externalLabel: 'Voir Lumin-ART Productions'
    },

    'memoire-eau': {
      category: 'Mapping vidéo · Architectural',
      cardCategory: 'Mapping vidéo',
      roleTitle: 'À mon compte',
      venue: 'Église St. Mark, Vieux-Longueuil',
      desc: 'Un mapping avec une commande bien à lui : tenir toute une soirée de festival à côté d’une scène musicale, et offrir aux gens un endroit où ralentir.',
      overview: 'Créée pour le Lumifest Longueuil 2023 et projetée sur le mur extérieur de l’église St. Mark, la pièce rend hommage à la molécule d’eau — présente dans chaque corps vivant et dans les écosystèmes autour. Sa place dans la programmation l’a façonnée autant que son sujet. Le mur jouxtait une scène musicale : l’oeuvre ne pouvait pas répondre au bruit par le bruit, il lui fallait tenir un calme dans lequel la foule puisse entrer.',
      role: 'Artiste 3D à mon compte — concept, simulation, look development, animation, compositing et pixel mapping',
      contribution: ['Écriture de la pièce et production menée seul, des premières images au pixel map livré pour la projection.', 'Construction de l’eau — simulation dans Fluid Flux, puis ombrage, éclairage et compositing — pour qu’elle se lise comme de l’eau depuis l’autre côté de la rue, et pas seulement de près.', 'Composition avec les ouvertures gothiques et les reliefs de l’église, plutôt qu’une projection par-dessus.', 'Rythme de la pièce calé sur le tempo de la scène musicale voisine.'],
      designIntent: 'L’eau traverse chaque corps et chaque écosystème, et la pièce lui rend hommage. À côté d’une scène musicale, elle avait aussi une tâche concrète : être la part tranquille de la soirée. La lenteur du fluide, la retenue de la palette et les longs mouvements viennent de là — un endroit où s’arrêter et respirer, comme l’eau le permet.',
      technicalChallenges: ['Le défi — un mur n’est pas un écran. Arcs gothiques, relief de pierre et ouvertures sombres déforment l’image et avalent la lumière, et l’eau qui porte la pièce devait rester reconnaissable de loin, la nuit, sur de la pierre.', 'La réponse de production — l’architecture est devenue une part de la composition au lieu d’un obstacle à recouvrir, et le fluide a été réglé pour la distance de vision plutôt que pour un réalisme de gros plan : mouvement plus ample, contraste plus fort, déplacement plus lent.', 'L’effet sur la production — l’image a tenu sur une surface irrégulière et a gardé le calme qu’elle était là pour offrir, à quelques mètres d’une scène qui jouait toute la soirée.'],
      pipeline: ['Concept et travail de références', 'Simulation de fluide dans Fluid Flux', 'Ombrage et éclairage', 'Animation et rythme calés sur le lieu', 'Compositing', 'Préparation du pixel map pour la façade'],
      impact: 'La pièce a été présentée au Lumifest Longueuil 2023 sur le mur de l’église St. Mark, comme le point lent d’une soirée construite autour d’une scène musicale.',
      externalLabel: 'Voir le Lumifest Longueuil'
    }
  },

  head: {
    home: {
      title: 'Killian Pichon — Généraliste 3D / Temps réel',
      description: 'Killian Pichon est un artiste immersif basé à Montréal, actif en graphisme temps réel, en direction technique et en narration visuelle, pour le cinéma fulldôme, le mapping vidéo et les expériences sur site.'
    },
    about: {
      title: 'Profil — Killian Pichon',
      description: 'Expérience de production, spécialisations et façon de travailler de Killian Pichon, artiste immersif basé à Montréal.'
    },
    technical: {
      title: 'Démarche de production — Killian Pichon',
      description: 'Études de production, décisions de flux de travail et intérêts en direction technique derrière le travail immersif de Killian Pichon.'
    },
    contact: {
      title: 'Contact — Killian Pichon',
      description: 'Écrire à Killian Pichon pour une offre d’emploi, une question générale ou une proposition de collaboration.'
    }
  },

  stale: []
};
