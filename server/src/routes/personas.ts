import { Router } from 'express';
import { Repos } from '../db/repos.js';
import { getPersona, personaList } from '../services/personas.js';
import { ERROR_CODES, sendError } from '../utils/response.js';

export function personasRouter(_repos: Repos): Router {
  const r = Router();

  /** 三套人格（PRD §10） */
  r.get('/', (_req, res) => {
    res.json({ items: personaList() });
  });

  r.get('/:id', (req, res) => {
    const p = getPersona(req.params.id);
    if (!p) {
      sendError(res, 404, ERROR_CODES.NOT_FOUND, '找不到对应人格');
      return;
    }
    res.json(p);
  });

  return r;
}
