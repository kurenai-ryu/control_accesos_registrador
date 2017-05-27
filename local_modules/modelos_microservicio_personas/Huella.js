module.exports = (sequelize, DataTypes) => {
  return sequelize.define('huellas', {
    huellaImagen: {
      field: 'imagen',
      type: DataTypes.STRING(73728),
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'El campo huella imágen no puede estar vacío'
        }
      }
    },
    huellaPlantilla: {
      field: 'plantilla',
      type: DataTypes.STRING(1024),
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'El campo huella plantilla no puede estar vacío'
        }
      }
    }
  }, {
    timestamps: true,
    paranoid: false,
    comment: 'Huellas registradas en el sistema',
    classMethods: {
      associate: function(modelo) {
        this.belongsTo(modelo.Personal, {
          foreignKey: 'id'
        });
      }
    }
  });
};
