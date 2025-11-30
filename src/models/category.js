import mongoose from 'mongoose';
const categoryScehma = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
});
// Index for search
categoryScehma.index({ name: 1 });
const Category = mongoose.model('Category', categoryScehma);
export default Category;
