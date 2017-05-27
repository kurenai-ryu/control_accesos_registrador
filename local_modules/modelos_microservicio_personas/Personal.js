module.exports = (sequelize, DataTypes) => {
  return sequelize.define('personal', {
    persona: {
      field: 'usuario',
      type: DataTypes.STRING(45),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          args: true,
          msg: 'El campo usuario no puede estar vacío'
        }
      }
    }
  }, {
    timestamps: true,
    paranoid: false,
    comment: 'Personal registrado en el sistema',
    classMethods: {
      associate: function(modelo) {
        this.hasOne(modelo.Huella, {
          foreignKey: 'id'
        });
      }
    }
  });
};
