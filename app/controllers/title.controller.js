const db = require("../models");
const Title = db.title;

exports.getTitles = async (req, res) => {
  try {
    const { type } = req.query;
    const data = await Title.find({ titleType: type });
    return res.status(200).json({ message: "Successfully Get!", data: data });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
};

exports.addTitle = async (req, res) => {
    try {
        const { item, type } = req.body;
        if (!type || !item) {
            return res.status(401).json({ message: "Incorrect Data" });
        }

        const isExist = await Title.findOne({ titleName: item, titleType: type });
        const data = await Title.find({});

        if (isExist) {
            return res.status(200).json({ message: "Already exist", data: data });
        } else {
            const auth = new Title({ titleName: item, titleType: type });
            await auth.save();
            const newData = await Title.find({ titleType: type });
            return res.status(200).json({ message: "Successfully Registered", data: newData });
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
};