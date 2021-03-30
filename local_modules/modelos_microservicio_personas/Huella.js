module.exports = (sequelize, DataTypes) => {
  return sequelize.define('huellas', {
    imagen: {
      field: 'huella_imagen',
      type: DataTypes.STRING(73728),
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'El campo imágen no puede estar vacío'
        }
      }
    },
    plantilla: {
      field: 'huella_plantilla',
      type: DataTypes.STRING(1024),
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'El campo plantilla no puede estar vacío'
        }
      }
    },
    fechaHora: {
      field: 'fechahora',
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    freezeTableName: true,
    timestamps: false,
    paranoid: false,
    comment: 'Huellas registradas en el sistema',
    name: {
      plural: 'Huellas',
      singular: 'Huella'
    },
    classMethods: {
      associate: function(modelo) {
        this.belongsTo(modelo.Personal, {
          foreignKey: 'id',
          onDelete: 'cascade'
        });
      }
    }
  });
};
