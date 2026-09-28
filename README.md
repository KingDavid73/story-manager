# Story Manager

A local-first workspace for organizing story projects, tracking continuity, and revising chapters.

## Development

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Run `npm run build` to type-check and build the app, or `npm run lint` to check the source.

## Local project data

Project state is stored in the browser's local storage. Optional source chapters and reworked-book data can be provided under `story-data/` and `public/story-data/`; these directories are ignored by Git so personal writing and project data stay out of this repository.
