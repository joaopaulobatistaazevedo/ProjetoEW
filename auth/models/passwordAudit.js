const mongoose = require('mongoose');

const passwordAuditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador', required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador', required: true },
  actorUsername: { type: String },
  targetUsername: { type: String },
  changedAt: { type: Date, default: Date.now },
  note: { type: String, default: '' }
}, { versionKey: false });

module.exports = mongoose.model('PasswordAudit', passwordAuditSchema);
