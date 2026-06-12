# Déploiement O'Takkos

## 1. Préparer Supabase

1. Ouvrir le projet Supabase.
2. Aller dans `SQL Editor`.
3. Coller et exécuter le contenu du fichier `supabase-schema.sql`.
4. Aller dans `Authentication` > `Users`.
5. Créer un utilisateur :
   - Email : `admin@otakkos.com`
   - Mot de passe : `admin`

Sur le site, le responsable continuera à se connecter avec :

- Nom d'utilisateur : `admin`
- Mot de passe : `admin`

Il pourra ensuite changer le mot de passe depuis la page admin.

## 2. Déployer sur Vercel

Dans Vercel :

1. Importer le dépôt GitHub.
2. Choisir le framework `Other`.
3. Définir le dossier racine du projet sur :

```text
outputs/otakkos-site
```

4. Laisser la commande de build vide.
5. Déployer.

Vercel donnera une adresse temporaire du type :

```text
https://nom-du-projet.vercel.app
```

## 3. Connecter le domaine OVH

1. Acheter le nom de domaine chez OVH.
2. Dans Vercel, aller dans `Settings` > `Domains`.
3. Ajouter le domaine.
4. Copier les DNS indiqués par Vercel dans OVH.

## 4. Vérifier après mise en ligne

Tester :

- Accueil
- À propos
- Menu
- Nos restaurants
- Carrières
- Contact
- Admin
- Boutons WhatsApp
- Réseaux sociaux
- Ajout d'une offre d'emploi
- Remplacement du menu
- Ajout d'un restaurant
