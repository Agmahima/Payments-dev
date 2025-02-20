const mongoose = require('mongoose');

const socialLinkSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', required: true },
  social_type: { type: String, required: true }, // e.g., 'Facebook', 'LinkedIn', 'Twitter'
  social_link: { type: String, required: true }, // URL of the social media profile
});

const SocialLink = mongoose.model('SocialLink', socialLinkSchema);
module.exports = SocialLink;
