const express = require('express');
const router = express.Router();
const { protectStaff, requireRoles } = require('../middleware/auth');
const { TEAM_MANAGER_ROLES } = require('../utils/roles');
const { imageUpload } = require('../middleware/upload');
const {
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember
} = require('../controllers/team.controller');

router.get('/', getTeamMembers); // عام: الاسم والصورة والنبذة ظاهرين افتراضيًا للجميع

router.post(
  '/',
  protectStaff,
  requireRoles(...TEAM_MANAGER_ROLES),
  imageUpload.single('photo'),
  createTeamMember
);

router.put(
  '/:id',
  protectStaff,
  requireRoles(...TEAM_MANAGER_ROLES),
  imageUpload.single('photo'),
  updateTeamMember
);

router.delete('/:id', protectStaff, requireRoles(...TEAM_MANAGER_ROLES), deleteTeamMember);

module.exports = router;
