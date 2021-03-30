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
    },
    tipo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    habilitado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    ingreso: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    freezeTableName: true,
    timestamps: false,
    paranoid: false,
    comment: 'Personal registrado en el sistema',
    name: {
      plural: 'Personas',
      singular: 'Persona'
    },
    classMethods: {
      associate: function(modelo) {
        this.hasOne(modelo.Huella, {
          foreignKey: 'id',
          onDelete: 'cascade'
        });
      }
    }
  });
};
