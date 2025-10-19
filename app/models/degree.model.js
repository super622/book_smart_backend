module.exports = mongoose => {
    var schema = mongoose.Schema({
        Did: {
            type: Number,
        },
        degreeName: {
            type: String,
            default: ''
        },
    });
  
    schema.method("toJSON", function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });
  
  
    const Degree = mongoose.model("Degree", schema);
    return Degree;
};