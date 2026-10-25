/**
 * Les cartes sont générées aléatoirement à chaque partie (voir mapgen.ts) :
 * ce module ne garde que les niveaux (taille, équipes, nombre de cases) et un
 * raccourci de génération.
 */
export { LEVELS, generateMap, levelById, type LevelDef } from './mapgen';
