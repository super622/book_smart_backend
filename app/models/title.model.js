module.exports = mongoose => {
    var schema = mongoose.Schema({
        titleName: {
            type: String,
            default: ''
        },
        titleType: {
            type: String,
            default: ''
        }
    });
  
    schema.method("toJSON", function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });
  
  
    const Title = mongoose.model("Title", schema);
    return Title;
};